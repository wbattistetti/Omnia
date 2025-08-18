import { useCallback, useRef, useState } from 'react';
import type { LogEvent } from './logger';
import type { DDTTemplateV2, HumanLikeConfig } from './model/ddt.v2.types';
import { initEngine, advance, type SimulatorState } from './engine';
import { setMemory } from './state';

export interface HookConfig {
  typingIndicatorMs?: number; // simple delay before applying engine advance
  onLog?: (e: LogEvent) => void;
  debug?: boolean; // if true, also log to console
}

export function useDDTSimulator(template: DDTTemplateV2, initialConfig?: HookConfig) {
  const [state, setState] = useState<SimulatorState>(() => initEngine(template));
  const cfgRef = useRef<HookConfig>({ typingIndicatorMs: 0, ...(initialConfig || {}) });
  const pendingBgRef = useRef<any | null>(null);

  const send = useCallback(async (input: string) => {
    cfgRef.current.onLog?.({ ts: Date.now(), kind: 'input', message: input });
    if (cfgRef.current.debug) {
      // eslint-disable-next-line no-console
      console.log('[DDE] input:', input);
    }
    const delay = Math.max(0, cfgRef.current.typingIndicatorMs || 0);
    await new Promise((res) => setTimeout(res, delay));
    setState((prev) => {
      const next = advance(prev, input);
      // Detailed memory debug (flattened) for inspection
      if (cfgRef.current.debug) {
        try {
          const mainId = next.plan.order[next.currentIndex];
          const flatten = (s: SimulatorState) => Object.fromEntries(Object.entries(s.memory || {}).map(([k, v]) => [k, v?.value]));
          console.log('[DDE] memory:', flatten(next));
          console.log('[DDE] main:', mainId, next.plan.byId[mainId]?.label);
        } catch {}
      }
      if (next.mode !== prev.mode) {
        cfgRef.current.onLog?.({ ts: Date.now(), kind: 'mode', message: `Mode -> ${next.mode}` });
        if (cfgRef.current.debug) {
          // eslint-disable-next-line no-console
          console.log('[DDE] mode:', next.mode);
        }
        // Opportunistic mixed‑initiative: background address parse of the SAME user input
        // We keep the engine pure (no async). Here we opportunistically enrich memory if an address is detected.
        try {
          const lastMsg = (next.transcript || []).length ? (next.transcript[(next.transcript || []).length - 1]?.text || '') : '';
          const text = (input || '').trim();
          const candidate = text || lastMsg;
          if (candidate && candidate.length >= 6 && !pendingBgRef.current) {
            pendingBgRef.current = true;
            console.log('[DDE] bg address fetch start');
            fetch('/api/parse-address', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: candidate }),
            })
              .then((r) => r.json())
              .then((data) => {
                console.log('[DDE] bg address response', data);
                if (data?.ok && data.address) {
                  const sanitizeAddress = (rawAddr: any, rawText: string) => {
                    const out: any = { ...(rawAddr || {}) };
                    const t = String(rawText || '');
                    const titleCase = (s?: string) => String(s || '')
                      .toLowerCase()
                      .replace(/\b([a-zà-ÿ])([a-zà-ÿ]*)/gi, (_, a, b) => a.toUpperCase() + b);
                    // 1) If city missing, try extract from street prefix: "ad/a/in <City> (in)? <via|viale|...>"
                    if (!out.city && typeof out.street === 'string') {
                      const m = out.street.match(/^\s*(?:ad|a|in)\s+([A-Za-zÀ-ÿ'\s]+?)(?:\s+in)?\s+(via|viale|corso|piazza|vicolo|strada|piazzale)\b/i);
                      if (m) {
                        out.city = titleCase(m[1].trim());
                        out.street = out.street.replace(m[0], m[2] + ' ').trim();
                      }
                    }
                    // 2) If city still missing, try from full text: "ad|a|in <City>" before road keywords
                    if (!out.city) {
                      const m2 = t.match(/\b(?:ad|a|in)\s+([A-Za-zÀ-ÿ'\s]{3,})\s+(?:in\s+)?(via|viale|corso|piazza|vicolo|strada|piazzale)\b/i);
                      if (m2) out.city = titleCase(m2[1].trim());
                    }
                    // 3) If number missing and street ends with a number token
                    if (!out.number && typeof out.street === 'string') {
                      const mn = out.street.match(/\b(\d+[A-Za-z]?)\b$/);
                      if (mn) { out.number = mn[1]; out.street = out.street.replace(/\s*\b\d+[A-Za-z]?\b\s*$/, '').trim(); }
                    }
                    // 4) If postal code missing and appears in street
                    if (!out.postal_code && typeof out.street === 'string') {
                      const mp = out.street.match(/\b(\d{5})\b/);
                      if (mp) { out.postal_code = mp[1]; out.street = out.street.replace(/\b\d{5}\b/, '').trim(); }
                    }
                    // 5) Clean street prepositions and city prefix duplication
                    if (typeof out.street === 'string') {
                      let s = out.street.replace(/^\s*(?:ad|a|in)\s+/i, '').trim();
                      if (out.city) {
                        const c = String(out.city).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const cityPrefix = new RegExp(`^\s*(?:${c})\s*(?:in\s+)?`, 'i');
                        s = s.replace(cityPrefix, '');
                      }
                      out.street = titleCase(s.replace(/\s{2,}/g, ' ').trim());
                    }
                    if (typeof out.city === 'string') out.city = titleCase(out.city);
                    if (typeof out.state === 'string') out.state = titleCase(out.state);
                    if (typeof out.country === 'string') out.country = titleCase(out.country);
                    return out;
                  };
                  const addr = sanitizeAddress(data.address as any, candidate);
                  cfgRef.current.onLog?.({ ts: Date.now(), kind: 'bg', message: 'address parsed' });
                  setState((curr) => {
                    try {
                      // Find address nodes and prefill subs when empty
                      let mem = curr.memory;
                      const cleanStreet = (raw: any, city?: any) => {
                        let s = String(raw || '').trim();
                        if (!s) return s;
                        // Strip leading prepositions like "ad ", "a ", "in "
                        s = s.replace(/^\s*(?:ad|a|in)\s+/i, '');
                        // If it redundantly starts with the city (e.g., "acqui terme in via …"), drop the city prefix
                        if (city) {
                          const c = String(city).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          const cityPrefix = new RegExp(`^\s*(?:${c})\s*(?:in\s+)?`, 'i');
                          s = s.replace(cityPrefix, '');
                        }
                        // Collapse spaces
                        s = s.replace(/\s{2,}/g, ' ').trim();
                        return s;
                      };

                      const mapVal = (label: string | undefined) => {
                        const l = String(label || '').toLowerCase();
                        // street / address
                        if (/(street|road|address|via|viale|corso|piazza|indirizzo)/i.test(l)) return cleanStreet(addr.street || addr.road, addr.city) || undefined;
                        // house number / civico
                        if (/(number|house|civico|nr|n°|num)/i.test(l)) return addr.number || addr.house_number || undefined;
                        // city / town / comune
                        if (/(city|town|comune|città|citta)/i.test(l)) return addr.city || undefined;
                        // postal code / CAP
                        if (/(postal|postcode|zip|cap)/i.test(l)) return addr.postal_code || addr.postcode || undefined;
                        // country / nazione / paese
                        if (/(country|nazione|paese)/i.test(l)) return addr.country || undefined;
                        return undefined;
                      };
                      for (const id of curr.plan.order) {
                        const node: any = curr.plan.byId[id];
                        if (!node) continue;
                        const labelStr = String((node.label || node.name || '')).toLowerCase();
                        const isAddressNode = (node.kind === 'address') || /address|indirizzo/.test(labelStr);
                        if (!isAddressNode) continue;
                        if (Array.isArray(node.subs) && node.subs.length > 0) {
                          for (const sid of node.subs) {
                            const sub = curr.plan.byId[sid];
                            const v = mapVal(sub?.label || sub?.name);
                            if (v !== undefined && (mem[sid]?.value === undefined || mem[sid]?.value === null)) {
                              mem = setMemory(mem, sid, v, false);
                              console.log('[DDE] bg address memWrite', { sid, v });
                            }
                          }
                          // Compose main from subs opportunistically
                          const composed: Record<string, any> = {};
                          for (const sid of node.subs) {
                            const mv = mem[sid]?.value;
                            if (mv !== undefined) composed[sid] = mv;
                          }
                          mem = setMemory(mem, node.id, composed, false);
                          console.log('[DDE] bg address composed', { id: node.id, composed });
                        } else {
                          // Atomic address main (rare): set a canonical object
                          const v = {
                            street: addr.street || addr.road,
                            number: addr.number || addr.house_number,
                            city: addr.city,
                            postal_code: addr.postal_code || addr.postcode,
                            country: addr.country,
                          };
                          mem = setMemory(mem, node.id, v, false);
                          console.log('[DDE] bg address memWrite', { id: node.id, v });
                        }
                      }
                      return { ...curr, memory: mem } as SimulatorState;
                    } catch {
                      return curr;
                    }
                  });
                }
              })
              .finally(() => {
                pendingBgRef.current = null;
                console.log('[DDE] bg address fetch done');
              });
          }
        } catch {}
      }
      if (next.currentSubId !== prev.currentSubId && next.currentSubId) {
        cfgRef.current.onLog?.({ ts: Date.now(), kind: 'subTarget', message: `Sub -> ${next.currentSubId}` });
        if (cfgRef.current.debug) {
          // eslint-disable-next-line no-console
          console.log('[DDE] subTarget:', next.currentSubId);
        }
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(initEngine(template));
  }, [template]);

  const setConfig = useCallback((next: HookConfig) => {
    cfgRef.current = { ...cfgRef.current, ...(next || {}) };
  }, []);

  return { state, send, reset, setConfig };
}


