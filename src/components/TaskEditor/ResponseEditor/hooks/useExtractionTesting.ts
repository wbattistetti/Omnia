import React, { useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { extractField } from '../../../../nlp/pipeline';
import { nerExtract } from '../../../../nlp/services/nerClient';
import nlpTypesConfig from '../../../../../config/nlp-types.json';
import { mapLabelToStandardKey } from './useRegexValidation';
import * as testingState from '../testingState';

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
  // ✅ Local state management (simpler approach)
  const [testing, setTesting] = useState<boolean>(false);
  const testingRef = useRef<boolean>(false);

  // State
  const [rowResults, setRowResults] = useState<RowResult[]>([]);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const cancelledRef = useRef<boolean>(false);

  // ✅ Initialize rowResults when examplesList changes
  // ✅ CRITICAL: NON includere rowResults.length nelle dipendenze per evitare loop infiniti
  React.useEffect(() => {
    setRowResults(prev => {
      // ✅ Solo se la lunghezza è diversa, aggiorna
      if (prev.length === examplesList.length) {
        return prev; // Nessun cambiamento necessario
      }

      const next = [...prev];
      // Extend array if needed
      while (next.length < examplesList.length) {
        next.push({});
      }
      // Truncate array if needed
      if (next.length > examplesList.length) {
        next.splice(examplesList.length);
      }
      return next;
    });
  }, [examplesList.length]); // ✅ SOLO examplesList.length, NON rowResults.length!
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

  // ✅ STEP 1: Run test for a single row - solo regex reale (sync), resto dummy
  const runRowTest = useCallback(async (idx: number, isBatch: boolean = false) => {
    const phrase = examplesList[idx] || '';
    if (!phrase) {
      return;
    }

    // ✅ STEP 1: Regex reale (sync) - nessuna chiamata async
    // ✅ Durante batch, calcoliamo solo summary (non spans) per evitare accumulo
    const t0Regex = performance.now();
    let regexRes: ReturnType<typeof extractRegexOnly>;
    if (isBatch) {
      // ✅ Versione semplificata: solo summary, niente spans
      const field = mapKindToField(kind);
      let value = '';
      const extractedGroups: Record<string, any> = {};

      if (profile.regex) {
        try {
          // ✅ Usa match() invece di exec() per evitare problemi con flag 'g'
          const re = new RegExp(profile.regex);
          const m = phrase.match(re);
          if (m) {
            value = m[0];
            // Extract capture groups (solo il primo match durante batch)
            if (m.length > 1 && node) {
              const allSubs = [...(node.subSlots || []), ...(node.subData || [])];
              for (let i = 1; i < m.length; i++) {
                const groupValue = m[i];
                if (groupValue !== undefined && groupValue !== null) {
                  const trimmedValue = String(groupValue).trim();
                  if (trimmedValue !== '') {
                    const subIndex = i - 1;
                    if (subIndex < allSubs.length) {
                      const sub = allSubs[subIndex];
                      const subLabel = String(sub.label || sub.name || '');
                      const standardKey = mapLabelToStandardKey(subLabel);
                      if (standardKey) {
                        extractedGroups[standardKey] = trimmedValue;
                      } else if (subLabel) {
                        extractedGroups[subLabel] = trimmedValue;
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Regex error
        }
      }

      const summary = Object.keys(extractedGroups).length > 0
        ? summarizeVars(extractedGroups, value)
        : (value ? `value=${value}` : '—');

      regexRes = { value, spans: [], summary, extractedGroups };
    } else {
      regexRes = extractRegexOnly(phrase);
    }
    const regexMs = Math.round(performance.now() - t0Regex);

    // ✅ Un solo setRowResults per riga
    // ✅ CRITICAL: flushSync forza rendering sincrono durante batch per evitare accumulo
    // ✅ CRITICAL: Durante batch, NON salvare spans per evitare accumulo di elementi React
    const updateRow = () => {
      setRowResults(prev => {
        const next = [...prev];
        next[idx] = {
          regex: enabledMethods.regex ? regexRes.summary : '—',
          regexMs: enabledMethods.regex ? regexMs : undefined,
          // ✅ Durante batch, spans vengono omessi per evitare accumulo di elementi React
          // Verranno calcolati on-demand quando necessario (non durante batch)
          spans: (isBatch ? undefined : (enabledMethods.regex ? regexRes.spans : undefined)),
          // ✅ Resto ancora dummy per ora
          deterministic: `dummy-det-${idx}`,
          ner: `dummy-ner-${idx}`,
          llm: `dummy-llm-${idx}`,
          running: false,
          detRunning: false,
          nerRunning: false,
          llmRunning: false,
        };
        return next;
      });
    };

    if (isBatch) {
      flushSync(updateRow);
    } else {
      updateRow();
    }

    // ✅ Solo per test singoli (non batch), aggiorna testing state
    if (!isBatch) {
      setSelectedRow(idx);
      testingRef.current = false;
      setTesting(false);
      testingState.stopTesting();
    }
  }, [examplesList, enabledMethods, extractRegexOnly, mapKindToField, node, profile.regex, summarizeVars]);

  // Compute stats from results (can accept results directly or use state)
  const computeStatsFromResults = useCallback((results?: RowResult[]) => {
    const resultsToUse = results || rowResults;
    let matched = 0;
    let falseAccept = 0;
    let totalGt = 0;
    (examplesList || []).forEach((_, rowIdx) => {
      const rr: any = resultsToUse[rowIdx] || {};
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
  }, [examplesList, kind, rowResults, cellOverrides, expectedKeysForKind]);

  // Run all rows
  const cancelTesting = useCallback(() => {
    cancelledRef.current = true;
    testingRef.current = false;
    setTesting(false);
    testingState.stopTesting();
  }, []);

  // ✅ BATCH MINIMALE: Cicla le righe e aggiorna con valori dummy
  // Nessuna chiamata reale, nessuna complessità - solo per verificare il wiring
  const runAllRows = useCallback(async () => {
    console.log('[BATCH_TEST] START (minimal)', { count: examplesList.length });

    // ✅ Prevent multiple simultaneous test runs
    if (testingRef.current || testing) {
      console.warn('[BATCH_TEST] Already testing, ignoring');
      return;
    }

    // ✅ Start testing state
    if (!testingState.getIsTesting()) {
      testingState.startTesting();
    }
    testingRef.current = true;
    setTesting(true);
    cancelledRef.current = false;

    try {
      // ✅ Simple loop: test each row one at a time
      for (let i = 0; i < examplesList.length; i++) {
        // ✅ Check if cancelled
        if (cancelledRef.current) {
          console.log('[BATCH_TEST] Cancelled', { at: i, total: examplesList.length });
          break;
        }

        const phrase = examplesList[i] || '';
        if (!phrase) {
          continue;
        }

        // ✅ Run test with dummy values
        await runRowTest(i, true); // true = isBatch mode
      }

      console.log('[BATCH_TEST] All rows completed');

      // ✅ Set selected row to last tested row
      if (examplesList.length > 0) {
        setSelectedRow(examplesList.length - 1);
      }

      // ✅ Compute stats using current state
      try {
        const stats = computeStatsFromResults();
        onStatsUpdate?.(stats);
      } catch (e) {
        console.error('[BATCH_TEST] Error computing stats:', e);
      }
    } catch (e) {
      console.error('[BATCH_TEST] Error:', e);
    } finally {
      // ✅ ALWAYS cleanup, even on error
      testingRef.current = false;
      setTesting(false);
      testingState.stopTesting();

      console.log('[BATCH_TEST] END');
    }
  }, [examplesList, testing, runRowTest, computeStatsFromResults, onStatsUpdate]);

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

