import React, { useState, useCallback, useRef } from 'react';
import { extractField } from '../../../../nlp/pipeline';
import { nerExtract } from '../../../../nlp/services/nerClient';
import nlpTypesConfig from '../../../../../config/nlp-types.json';
import { mapLabelToStandardKey } from './useRegexValidation';

export interface RowResult {
  regex?: string;
  deterministic?: string;
  ner?: string;
  llm?: string;
  regexMs?: number;
  detMs?: number;
  nerMs?: number;
  llmMs?: number;
  running?: boolean;
  detRunning?: boolean;
  nerRunning?: boolean;
  llmRunning?: boolean;
  spans?: Array<{ start: number; end: number }>;
  value?: string;
  confidence?: number;
  variables?: Record<string, any>;
}

interface UseExtractionTestingProps {
  examplesList: string[];
  kind: string;
  synonymsText: string;
  formatText: string;
  profile: { regex?: string };
  onStatsUpdate?: (stats: { matched: number; falseAccept: number; totalGt: number }) => void;
  node?: any; // Node with subData/subSlots for group mapping
}

// Helper functions
function toCommaList(list?: string[] | null): string {
  return Array.isArray(list) ? list.join(', ') : '';
}

function fromCommaList(text: string): string[] {
  return (text || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 0 && arr.indexOf(s) === i);
}

function summarizeVars(vars?: Record<string, any>, fallbackValue?: string): string {
  if (!vars || typeof vars !== 'object') return fallbackValue ? `value=${fallbackValue}` : '—';
  const entries = Object.entries(vars).filter(([, v]) => v != null && v !== '');
  if (!entries.length && fallbackValue) return `value=${fallbackValue}`;
  // If fallbackValue is provided, include it at the beginning
  const varsStr = entries.map(([k, v]) => `${k}=${v}`).join(', ');
  return fallbackValue ? `value=${fallbackValue}, ${varsStr}` : varsStr;
}

const findAllOccurrences = (text: string, sub: string): Array<{ start: number; end: number }> => {
  const spans: Array<{ start: number; end: number }> = [];
  if (!sub) return spans;
  const needle = sub.toLowerCase();
  const hay = text.toLowerCase();
  let idx = 0;
  while ((idx = hay.indexOf(needle, idx)) !== -1) {
    spans.push({ start: idx, end: idx + needle.length });
    idx += Math.max(1, needle.length);
  }
  return spans;
};

const mergeSpans = (a: Array<{ start: number; end: number }>, b: Array<{ start: number; end: number }>) => {
  const all = [...(a || []), ...(b || [])].sort((x, y) => x.start - y.start);
  if (!all.length) return [] as Array<{ start: number; end: number }>;
  const merged: Array<{ start: number; end: number }> = [all[0]];
  for (let i = 1; i < all.length; i += 1) {
    const last = merged[merged.length - 1];
    const cur = all[i];
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else merged.push({ ...cur });
  }
  return merged;
};

const italianMonths = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre','gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

const spansFromDate = (phrase: string, v?: { day?: any; month?: any; year?: any }) => {
  const spans: Array<{ start: number; end: number }> = [];
  if (!v) return spans;
  const addNum = (num?: any) => {
    const s = String(num || '').trim();
    if (!s) return;
    const variants = new Set([s, s.padStart(2, '0')]);
    variants.forEach((vv) => { spans.push(...findAllOccurrences(phrase, vv)); });
  };
  addNum(v.day);
  addNum(v.year);
  if (typeof v.month !== 'undefined') {
    const mStr = String(v.month).toLowerCase();
    const mNum = parseInt(mStr, 10);
    if (!Number.isNaN(mNum)) {
      const variants = new Set([String(mNum), String(mNum).padStart(2, '0')]);
      variants.forEach((vv) => { spans.push(...findAllOccurrences(phrase, vv)); });
    }
    italianMonths.forEach((nm) => {
      if (findAllOccurrences(phrase, nm).length) spans.push(...findAllOccurrences(phrase, nm));
    });
  }
  return spans;
};

const spansFromScalar = (phrase: string, value?: any) => {
  const v = (value == null ? '' : String(value)).trim();
  if (!v) return [] as Array<{ start: number; end: number }>;
  return findAllOccurrences(phrase, v);
};

const expectedKeysForKind = (k: string): string[] => {
  const s = (k || '').toLowerCase();
  if (s === 'date') return ['day', 'month', 'year'];
  if (s === 'email' || s === 'phone' || s === 'number' || s === 'name' || s === 'address') return ['value'];
  return ['value'];
};

export function useExtractionTesting({
  examplesList,
  kind,
  synonymsText,
  formatText,
  profile,
  onStatsUpdate,
  node,
}: UseExtractionTestingProps) {
  // State
  const [rowResults, setRowResults] = useState<RowResult[]>([]);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [testing, setTesting] = useState<boolean>(false);
  const cancelledRef = useRef<boolean>(false);
  const [cellOverrides, setCellOverrides] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: 'det' | 'ner' | 'llm';
    key: string;
  } | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [enabledMethods, setEnabledMethods] = useState({
    regex: true,
    deterministic: true,
    ner: true,
    llm: true
  });

  // Map kind to field name
  const mapKindToField = useCallback((k: string): string => {
    const s = (k || '').toLowerCase();

    // Special mapping: number → age (per estrazione età)
    if (s === 'number') {
      const synonyms = toCommaList(fromCommaList(synonymsText)).toLowerCase();
      const examplesText = (examplesList || []).join(' ').toLowerCase();

      const hasAgeWords = /(età|age|anni|vecchio|giovane)/i.test(synonyms);
      const hasAgeExamples = /(18|21|30|40|50|60|70|80|90|100)/.test(examplesText);

      if (hasAgeWords || hasAgeExamples) {
        return 'age';
      }
    }

    // Use extractorMapping from config
    const extractorMapping = nlpTypesConfig.extractorMapping as Record<string, string>;
    if (extractorMapping[s]) {
      return extractorMapping[s];
    }

    // Auto/Generic → heuristic mapping to date
    if (s === 'generic' || s === 'auto') {
      const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre','gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
      const examplesText = (examplesList || []).join(' ').toLowerCase();
      const synonyms = toCommaList(fromCommaList(synonymsText)).toLowerCase();
      const formats = (formatText || '').toLowerCase();
      const hasMonth = months.some((m) => examplesText.includes(m));
      const hasNumericDate = /\b\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\b/.test(examplesText);
      const hasYear = /\b(19\d{2}|20\d{2})\b/.test(examplesText);
      const hasDateWords = /(data|nascit|birth|dob)/.test(synonyms);
      const hasDateFormatHint = /(dd|yyyy|mmm)/.test(formats);
      if (hasMonth || hasNumericDate || (hasYear && hasDateWords) || hasDateFormatHint) {
        console.log('[Tester][LOCAL] auto-map generic → dateOfBirth');
        return 'dateOfBirth';
      }
    }
    return 'generic';
  }, [kind, synonymsText, formatText, examplesList]);

  // Extract regex only
  const extractRegexOnly = useCallback((text: string) => {
    const spans: Array<{ start: number; end: number }> = [];
    let value = '';
    const extractedGroups: Record<string, any> = {};

    if (profile.regex) {
      try {
        const re = new RegExp(profile.regex, 'g');
        let m: RegExpExecArray | null;
        let matchCount = 0;
        // eslint-disable-next-line no-cond-assign
        while ((m = re.exec(text)) !== null) {
          matchCount++;
          spans.push({ start: m.index, end: m.index + m[0].length });
          if (!value) {
            value = m[0];

            // Extract capture groups and map them to sub-data
            if (m.length > 1 && node) {
              const allSubs = [...(node.subSlots || []), ...(node.subData || [])];

              // Iterate through capture groups (m[1], m[2], m[3], ...)
              for (let i = 1; i < m.length; i++) {
                const groupValue = m[i];
                if (groupValue !== undefined && groupValue !== null) {
                  const trimmedValue = String(groupValue).trim();
                  if (trimmedValue !== '') {
                    // Map group to corresponding sub-data index
                    const subIndex = i - 1; // Group 1 -> subIndex 0, Group 2 -> subIndex 1, etc.
                    if (subIndex < allSubs.length) {
                      const sub = allSubs[subIndex];
                      const subLabel = String(sub.label || sub.name || '');
                      const standardKey = mapLabelToStandardKey(subLabel);

                      if (standardKey) {
                        extractedGroups[standardKey] = trimmedValue;
                      } else if (subLabel) {
                        // Fallback: use original label
                        extractedGroups[subLabel] = trimmedValue;
                      }
                    }
                  }
                }
              }
            }
          }
        }

      } catch (e) {
        // Regex error - silently fail
      }
    }

    // Use summarizeVars if groups were extracted, otherwise fallback
    // Always include value= when groups are extracted so the full match is visible
    const summary = Object.keys(extractedGroups).length > 0
      ? summarizeVars(extractedGroups, value)
      : (value ? `value=${value}` : '—');

    return { value, spans, summary, extractedGroups };
  }, [profile.regex, node]);

  // Summarize extraction result
  const summarizeResult = useCallback((result: any, currentField: string): string => {
    try {
      if (!result || result.status !== 'accepted' || result.value === undefined || result.value === null)
        return "—";

      if (currentField === 'age') {
        return `value=${result.value}`;
      }

      if (currentField === 'dateOfBirth') {
        const v: any = result.value || {};
        return summarizeVars({ day: v.day, month: v.month, year: v.year },
          v.day && v.month && v.year ? `${String(v.day).padStart(2,'0')}/${String(v.month).padStart(2,'0')}/${v.year}` : undefined);
      } else if (currentField === 'phone') {
        const v: any = result.value || {};
        return v.e164 ? `value=${v.e164}` : '—';
      } else if (currentField === 'email') {
        return result.value ? `value=${String(result.value)}` : '—';
      } else {
        return result.value ? `value=${String(result.value)}` : '—';
      }
    } catch (error) {
      console.error('[NLP_TESTER] summarizeResult error:', error, { result, currentField });
      return "—";
    }
  }, []);

  // Toggle method enabled/disabled
  const toggleMethod = useCallback((method: keyof typeof enabledMethods) => {
    setEnabledMethods(prev => ({
      ...prev,
      [method]: !prev[method]
    }));
  }, []);

  // Run test for a single row
  const runRowTest = useCallback(async (idx: number) => {
    const phrase = examplesList[idx] || '';
    if (!phrase) return;
    setTesting(true);

    const update = (partial: any) => setRowResults(prev => {
      const next = [...prev];
      next[idx] = { ...(next[idx] || {}), ...partial };
      return next;
    });

    update({ running: true, detRunning: true, nerRunning: true, llmRunning: true, regex: '—', deterministic: '—', ner: '—', llm: '—' });

    // Regex (sync) - always runs
    const t0Regex = performance.now();
    const regexRes = extractRegexOnly(phrase);
    update({ regex: regexRes.summary, regexMs: Math.round(performance.now() - t0Regex), spans: regexRes.spans });

    const field = mapKindToField(kind);


    // Deterministic async task
    const detTask = enabledMethods.deterministic ? (async () => {
      const t0 = performance.now();
      update({ detRunning: true });
      try {
        const finalResult = await extractField<any>(field, phrase);
        const detSummary = finalResult.allResults?.deterministic ? summarizeResult(finalResult.allResults.deterministic, field) : "—";
        const nerSummary = finalResult.allResults?.ner ? summarizeResult(finalResult.allResults.ner, field) : "—";
        const llmSummary = finalResult.allResults?.llm ? summarizeResult(finalResult.allResults.llm, field) : "—";

        update({
          deterministic: detSummary,
          ner: nerSummary,
          llm: llmSummary,
          status: 'done',
          detMs: Math.round(performance.now() - t0),
          detRunning: false
        });
      } catch {
        update({ deterministic: '—', detMs: Math.round(performance.now() - t0), detRunning: false });
      }
    })() : Promise.resolve();

    // NER async task
    const nerTask = enabledMethods.ner ? (async () => {
      const t0 = performance.now();
      update({ nerRunning: true });
      try {
        const ner = await nerExtract<any>(field, phrase);
        let nerSummary = '—';
        let nerSpans: Array<{ start: number; end: number }> = [];
        if (Array.isArray(ner?.candidates) && ner.candidates.length > 0) {
          const c = ner.candidates[0];
          if (field === 'dateOfBirth') {
            nerSummary = summarizeVars({ day: c?.value?.day, month: c?.value?.month, year: c?.value?.year });
            nerSpans = spansFromDate(phrase, c?.value);
          } else if (field === 'phone') {
            nerSummary = c?.value ? `value=${String(c.value)}` : '—';
            nerSpans = spansFromScalar(phrase, c?.value);
          } else if (field === 'email') {
            nerSummary = c?.value ? `value=${String(c.value)}` : '—';
            nerSpans = spansFromScalar(phrase, c?.value);
          } else if (c?.value) {
            nerSpans = spansFromScalar(phrase, c?.value);
          }
        }
        setRowResults(prev => {
          const next = [...prev];
          const base = ((next[idx] || {}) as any).spans || [];
          next[idx] = { ...(next[idx] || {}), ner: nerSummary, nerMs: Math.round(performance.now() - t0), nerRunning: false, spans: mergeSpans(base, nerSpans) } as any;
          return next;
        });
      } catch {
        update({ ner: '—', nerMs: Math.round(performance.now() - t0), nerRunning: false });
      }
    })() : Promise.resolve();

    // LLM async task
    const llmTask = enabledMethods.llm ? (async () => {
      const t0 = performance.now();
      update({ llmRunning: true });
      try {
        const res = await fetch('/api/nlp/llm-extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, text: phrase, lang: 'it' }) });
        let llmSummary = '—';
        let llmSpans: Array<{ start: number; end: number }> = [];
        if (res.ok) {
          const obj = await res.json();
          if (Array.isArray(obj?.candidates) && obj.candidates.length > 0) {
            const c = obj.candidates[0];
            if (field === 'dateOfBirth' && c?.value) {
              llmSummary = summarizeVars({ day: c.value.day, month: c.value.month, year: c.value.year });
              llmSpans = spansFromDate(phrase, c.value);
            } else if (field === 'phone') {
              llmSummary = c?.value ? `value=${String(c.value)}` : '—';
              llmSpans = spansFromScalar(phrase, c?.value);
            } else if (field === 'email') {
              llmSummary = c?.value ? `value=${String(c.value)}` : '—';
              llmSpans = spansFromScalar(phrase, c?.value);
            } else if (c?.value) {
              llmSpans = spansFromScalar(phrase, c?.value);
            }
          }
        }
        setRowResults(prev => {
          const next = [...prev];
          const base = ((next[idx] || {}) as any).spans || [];
          next[idx] = { ...(next[idx] || {}), llm: llmSummary, llmMs: Math.round(performance.now() - t0), llmRunning: false, spans: mergeSpans(base, llmSpans) } as any;
          return next;
        });
      } catch {
        update({ llm: '—', llmMs: Math.round(performance.now() - t0), llmRunning: false });
      }
    })() : Promise.resolve();

    await Promise.allSettled([detTask, nerTask, llmTask]);
    update({ running: false });
    setSelectedRow(idx);
    setTesting(false);
  }, [examplesList, kind, profile, enabledMethods, mapKindToField, extractRegexOnly, summarizeResult]);

  // Compute stats from results (must be defined before runAllRows)
  const computeStatsFromResults = useCallback(() => {
    let matched = 0;
    let falseAccept = 0;
    let totalGt = 0;
    (examplesList || []).forEach((_, rowIdx) => {
      const rr: any = rowResults[rowIdx] || {};
      const keys = expectedKeysForKind(kind);
      const parseSummary = (text?: string) => {
        const out: Record<string, string | undefined> = {};
        const t = (text || '').toString();
        if (!t || t === '—') return out;
        t.split(',').forEach((p) => {
          const sp = p.split('=');
          const k = sp[0]?.trim();
          const v = sp[1] != null ? String(sp[1]).trim() : undefined;
          if (k) out[k] = v;
        });
        return out;
      };
      const det = parseSummary(rr.deterministic);
      const ner = parseSummary(rr.ner);
      const llm = parseSummary(rr.llm);
      keys.forEach((kKey) => {
        const gt = cellOverrides[`${rowIdx}:det:${kKey}`];
        if (typeof gt === 'undefined') return;
        totalGt += 1;
        const pred = det[kKey] ?? ner[kKey] ?? llm[kKey];
        if (!pred) return;
        if (pred === gt) matched += 1; else falseAccept += 1;
      });
    });
    return { matched, falseAccept, totalGt };
  }, [examplesList, kind, rowResults, cellOverrides]);

  // Run all rows
  const cancelTesting = useCallback(() => {
    cancelledRef.current = true;
    setTesting(false);
  }, []);

  const runAllRows = useCallback(async () => {
    cancelledRef.current = false; // Reset flag all'inizio
    setTesting(true);
    for (let i = 0; i < examplesList.length; i += 1) {
      // Controlla se l'esecuzione è stata cancellata
      if (cancelledRef.current) {
        setTesting(false);
        return; // Interrompi l'esecuzione
      }
      await runRowTest(i);
    }
    // Compute stats after run (solo se non cancellato)
    if (!cancelledRef.current) {
      try {
        const stats = computeStatsFromResults();
        onStatsUpdate?.(stats);
      } catch {}
      setTesting(false);
    }
  }, [examplesList.length, runRowTest, computeStatsFromResults, onStatsUpdate]);

  return {
    // State
    rowResults,
    setRowResults,
    selectedRow,
    setSelectedRow,
    testing,
    setTesting,
    cellOverrides,
    setCellOverrides,
    editingCell,
    setEditingCell,
    editingText,
    setEditingText,
    enabledMethods,
    // Functions
    runRowTest,
    runAllRows,
    cancelTesting,
    toggleMethod,
    computeStatsFromResults,
    // Helpers
    summarizeVars,
    findAllOccurrences,
    mergeSpans,
    spansFromDate,
    spansFromScalar,
    expectedKeysForKind: (k?: string) => expectedKeysForKind(k || kind),
    mapKindToField,
  };
}

