import type { SimulatorState } from '../engine';
import { setMemory } from '../state';

function titleCase(s?: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])([a-zà-ÿ]*)/gi, (_, a, b) => a.toUpperCase() + b);
}

function sanitizeAddress(raw: any, rawText: string) {
  const out: any = { ...(raw || {}) };
  const t = String(rawText || '');
  // infer city from patterns
  if (!out.city && typeof out.street === 'string') {
    const m = out.street.match(/^\s*(?:ad|a|in)\s+([A-Za-zÀ-ÿ'\s]+?)(?:\s+in)?\s+(via|viale|corso|piazza|vicolo|strada|piazzale)\b/i);
    if (m) {
      out.city = titleCase(m[1].trim());
      out.street = out.street.replace(m[0], m[2] + ' ').trim();
    }
  }
  if (!out.city) {
    const m2 = t.match(/\b(?:ad|a|in)\s+([A-Za-zÀ-ÿ'\s]{3,})\s+(?:in\s+)?(via|viale|corso|piazza|vicolo|strada|piazzale)\b/i);
    if (m2) out.city = titleCase(m2[1].trim());
  }
  if (!out.number && typeof out.street === 'string') {
    const mn = out.street.match(/\b(\d+[A-Za-z]?)\b$/);
    if (mn) { out.number = mn[1]; out.street = out.street.replace(/\s*\b\d+[A-Za-z]?\b\s*$/, '').trim(); }
  }
  if (!out.postal_code && typeof out.street === 'string') {
    const mp = out.street.match(/\b(\d{5})\b/);
    if (mp) { out.postal_code = mp[1]; out.street = out.street.replace(/\b\d{5}\b/, '').trim(); }
  }
  if (!out.postal_code) {
    const mcap = t.match(/\b(?:cap\s*[:=]?\s*)?(\d{5})\b/i);
    if (mcap) { out.postal_code = mcap[1]; }
  }
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
}

export function runAddressEnrichment(candidate: string, setState: (updater: (curr: SimulatorState) => SimulatorState) => void) {
  const text = (candidate || '').trim();
  if (!text || text.length < 6) return;
  fetch('/api/parse-address', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
    .then((r) => {
      if (!r.ok) {
        console.warn('[AddressEnrichment] Endpoint not available:', r.status);
        return null;
      }
      return r.json();
    })
    .then((data) => {
      if (!data?.ok || !data.address) return;
      const addr = sanitizeAddress(data.address, text);
      setState((curr) => {
        try {
          let mem = curr.memory;
          for (const id of curr.plan.order) {
            const node: any = curr.plan.byId[id];
            if (!node) continue;
            const labelStr = String((node.label || node.name || '')).toLowerCase();
            const isAddressNode = (node.kind === 'address') || /address|indirizzo/.test(labelStr);
            if (!isAddressNode) continue;
            if (Array.isArray(node.subs) && node.subs.length > 0) {
              const mapVal = (label?: string) => {
                const l = String(label || '').toLowerCase();
                if (/(street|road|address|via|viale|corso|piazza|indirizzo)/i.test(l)) return (addr.street || addr.road) || undefined;
                if (/(number|house|civico|nr|n°|num)/i.test(l)) return addr.number || addr.house_number || undefined;
                if (/(city|town|comune|città|citta)/i.test(l)) return addr.city || undefined;
                if (/(postal|postcode|zip|cap)/i.test(l)) return addr.postal_code || addr.postcode || undefined;
                if (/(country|nazione|paese)/i.test(l)) return addr.country || undefined;
                return undefined;
              };
              for (const sid of node.subs) {
                const sub = curr.plan.byId[sid] as any;
                const v = mapVal(sub?.label || sub?.name);
                if (v !== undefined) {
                  mem = setMemory(mem, sid, v, false);
                }
              }
              const composed: Record<string, any> = {};
              for (const sid of node.subs) {
                const mv = (mem as any)[sid]?.value;
                if (mv !== undefined) composed[sid] = mv;
              }
              mem = setMemory(mem, node.id, composed, false);
            } else {
              const v = {
                street: addr.street || addr.road,
                number: addr.number || addr.house_number,
                city: addr.city,
                postal_code: addr.postal_code || addr.postcode,
                country: addr.country,
              };
              mem = setMemory(mem, node.id, v, false);
            }
          }
          return { ...curr, memory: mem } as SimulatorState;
        } catch {
          return curr;
        }
      });
    })
    .catch((err) => {
      // Silently fail if endpoint is not available
      console.debug('[AddressEnrichment] Endpoint not available or error:', err.message);
    });
}


