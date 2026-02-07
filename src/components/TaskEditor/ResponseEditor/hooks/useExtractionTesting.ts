import React, { useState, useCallback, useRef } from 'react';
import { extractField } from '@utils/nlp/pipeline';
import { nerExtract } from '@utils/nlp/services/nerClient';
import nlpTypesConfig from '@config/nlp-types.json';
import { mapLabelToStandardKey } from '@responseEditor/hooks/useRegexValidation';
import * as testingState from '@responseEditor/testingState';
import { loadContractFromNode } from '@responseEditor/ContractSelector/contractHelpers';
import { TestExtractionService } from '@services/TestExtractionService';
import { useCellOverridesStore } from '@responseEditor/features/step-management/stores/cellOverridesStore';

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
  const prevExamplesLengthRef = React.useRef<number>(examplesList.length);
  React.useEffect(() => {
    const prevLength = prevExamplesLengthRef.current;
    const currentLength = examplesList.length;

    setRowResults(prev => {
      // ✅ Solo se la lunghezza è diversa, aggiorna
      if (prev.length === currentLength) {
        return prev; // Nessun cambiamento necessario
      }

      const next = [...prev];
      // Extend array if needed
      while (next.length < currentLength) {
        next.push({});
      }
      // Truncate array if needed
      if (next.length > currentLength) {
        next.splice(currentLength);
      }
      return next;
    });

    // ✅ FASE 2 - CRITICAL FIX: Clean up overrides for removed rows
    // When examplesList shrinks, remove overrides for rows that no longer exist
    if (prevLength > currentLength) {
      const cellOverridesStoreState = useCellOverridesStore.getState();
      const allOverrides = cellOverridesStoreState.getAllOverrides();
      const cleanedOverrides: Record<string, string> = {};

      // Keep only overrides for rows that still exist
      Object.keys(allOverrides).forEach((key) => {
        const match = key.match(/^(\d+):/);
        if (match) {
          const rowIdx = parseInt(match[1], 10);
          if (rowIdx < currentLength) {
            cleanedOverrides[key] = allOverrides[key];
          }
        }
      });

      cellOverridesStoreState.setOverrides(cleanedOverrides);
      console.log('[CELL_OVERRIDES] Cleaned up overrides for removed rows', {
        prevLength,
        currentLength,
        removedRows: prevLength - currentLength,
        overridesBefore: Object.keys(allOverrides).length,
        overridesAfter: Object.keys(cleanedOverrides).length,
      });
    }

    prevExamplesLengthRef.current = currentLength;
  }, [examplesList.length]); // ✅ SOLO examplesList.length, NON rowResults.length!

  // ✅ FASE 2 - OPTIMIZATION: Use Zustand store instead of useState for cellOverrides
  // This eliminates prop drilling and reduces re-renders
  const cellOverridesStore = useCellOverridesStore();
  const cellOverrides = cellOverridesStore.getAllOverrides();
  const setCellOverrides = (updater: React.SetStateAction<Record<string, string>>) => {
    const current = cellOverridesStore.getAllOverrides();
    const next = typeof updater === 'function' ? updater(current) : updater;
    cellOverridesStore.setOverrides(next);
  };

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

  // ✅ Helper: Get effective regex (from profile or fallback to contract)
  const getEffectiveRegex = useCallback((): string | undefined => {
    // ✅ First try profile.regex
    if (profile.regex) {
      return profile.regex;
    }

    // ✅ Fallback: Try to load from contract
    if (node) {
      try {
        const contract = loadContractFromNode(node);
        const regexPattern = contract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
        if (regexPattern) {
          console.log('[TEST] 🔄 Fallback: Using regex from contract', {
            nodeId: node.id,
            regexPattern: regexPattern.substring(0, 50)
          });
          return regexPattern;
        }
      } catch (e) {
        console.warn('[TEST] ⚠️ Error loading contract for regex fallback', e);
      }
    }

    // ✅ Last resort: Try node.nlpProfile.regex
    if (node?.nlpProfile?.regex) {
      console.log('[TEST] 🔄 Fallback: Using regex from node.nlpProfile', {
        nodeId: node.id,
        regexPattern: node.nlpProfile.regex.substring(0, 50)
      });
      return node.nlpProfile.regex;
    }

    return undefined;
  }, [profile.regex, node]);

  // Extract regex only
  const extractRegexOnly = useCallback((text: string) => {
    const spans: Array<{ start: number; end: number }> = [];
    let value = '';
    const extractedGroups: Record<string, any> = {};

    // ✅ Get effective regex (with fallback)
    const effectiveRegex = getEffectiveRegex();

    // ✅ ERROR: Se effectiveRegex è undefined, mostra errore e non procedere
    if (!effectiveRegex) {
      console.error('[TEST] ❌ ERROR - extractRegexOnly called without regex!', {
        'profile.regex': profile.regex,
        'text': text.substring(0, 30),
        'profile keys': Object.keys(profile),
        'node.nlpProfile.regex': node?.nlpProfile?.regex,
        'message': 'This is a synchronization issue between contract and profile!'
      });
      // ✅ Ritorna risultato vuoto con errore nel summary
      return { value: '', spans: [], summary: '❌ ERROR: regex not synced', extractedGroups: {} };
    }

    if (effectiveRegex) {
      try {
        // ✅ FIX: Usa la stessa logica del batch mode - trova TUTTI i match e prendi il più lungo
        // Questo risolve il problema di matchare solo "1" invece di "12" o "13"
        const re = new RegExp(effectiveRegex, 'g');
        let bestMatch: RegExpExecArray | null = null;
        let longestMatch = '';
        let match: RegExpExecArray | null;
        let matchCount = 0;

        // Reset lastIndex per assicurarsi di iniziare dall'inizio
        re.lastIndex = 0;

        // Trova tutti i match e prendi il più lungo
        while ((match = re.exec(text)) !== null) {
          matchCount++;
          spans.push({ start: match.index, end: match.index + match[0].length });
          if (match[0].length > longestMatch.length) {
            longestMatch = match[0];
            bestMatch = match;
          }
        }

          // Se non abbiamo trovato match con flag 'g', prova senza flag (match globale)
          if (!bestMatch) {
            const reNoG = new RegExp(effectiveRegex);
          const m = text.match(reNoG);
          if (m && m[0].length > longestMatch.length) {
            bestMatch = m as RegExpExecArray;
            longestMatch = m[0];
            if (m.index !== undefined) {
              spans.push({ start: m.index, end: m.index + m[0].length });
            }
          }
        }

        if (bestMatch) {
          value = bestMatch[0]; // ✅ Usa il match più lungo

          // ✅ Extract named groups from match.groups (if available)
          if (bestMatch.groups && node) {
            // Use named groups directly
            Object.entries(bestMatch.groups).forEach(([groupName, groupValue]) => {
              if (groupValue !== undefined && groupValue !== null) {
                const trimmedValue = String(groupValue).trim();
                if (trimmedValue !== '') {
                  // ✅ Use groupName directly as key (should match subTaskKey)
                  extractedGroups[groupName] = trimmedValue;
                }
              }
            });
          } else if (bestMatch.length > 1 && node) {
            // ✅ Fallback: numeric groups (backward compatibility)
            const allSubs = [...(node.subSlots || []), ...(node.subData || [])];

            // Iterate through capture groups (m[1], m[2], m[3], ...)
            for (let i = 1; i < bestMatch.length; i++) {
              const groupValue = bestMatch[i];
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
  }, [getEffectiveRegex]);

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

  // ✅ STEP 1: Run test for a single row - uses backend runtime (engine + contract)
  const runRowTest = useCallback(async (idx: number, isBatch: boolean = false) => {
    const phrase = examplesList[idx] || '';
    if (!phrase) {
      return;
    }

    // ✅ Use backend runtime if node.id is available
    if (node?.id && enabledMethods.regex) {
      const t0Regex = performance.now();
      try {
        const result = await TestExtractionService.testExtraction(node.id, phrase);
        const regexMs = Math.round(performance.now() - t0Regex);

        // Convert ExtractionResult to RowResult format
        const summary = Object.keys(result.values).length > 0
          ? summarizeVars(result.values, result.values.value || '')
          : (result.hasMatch ? 'value=matched' : '—');

        setRowResults(prev => {
          const next = [...prev];
          next[idx] = {
            regex: enabledMethods.regex ? summary : '—',
            regexMs: enabledMethods.regex ? regexMs : undefined,
            spans: result.hasMatch ? [] : undefined, // TODO: Calculate spans from match
            deterministic: `dummy-det-${idx}`,
            ner: `dummy-ner-${idx}`,
            llm: `dummy-llm-${idx}`,
            running: false,
            detRunning: false,
            nerRunning: false,
            llmRunning: false,
            variables: result.values
          };
          return next;
        });

        if (!isBatch) {
          setSelectedRow(idx);
          testingRef.current = false;
          setTesting(false);
          testingState.stopTesting();
        }

        return;
      } catch (error) {
        console.error('[TEST] Error calling backend test extraction:', error);
        // Fallback to local extraction
      }
    }

    // ✅ FALLBACK: Local extraction (backward compatibility)
    // ✅ DIAGNOSTIC LOG: Verifica profile.regex prima del test
    console.log('[TEST] runRowTest - Diagnostic', {
      idx,
      phrase,
      'profile.regex': profile.regex,
      'profile.regex type': typeof profile.regex,
      'profile.regex length': profile.regex?.length,
      'profile.regex preview': profile.regex?.substring(0, 50),
      'enabledMethods.regex': enabledMethods.regex,
      'profile object keys': Object.keys(profile),
    });

    // ✅ ERROR: Se profile.regex è undefined, mostra errore chiaro
    if (!profile.regex && enabledMethods.regex) {
      console.error('[TEST] ❌ ERROR - profile.regex is undefined!', {
        idx,
        phrase,
        'profile.regex': profile.regex,
        'node.nlpProfile.regex': node?.nlpProfile?.regex,
        'node.id': node?.id,
          'node.templateId': node?.templateId,
          'message': 'This means contract and profile are NOT synced!'
        });
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

      // ✅ Get effective regex (with fallback)
      const effectiveRegex = getEffectiveRegex();

      // ✅ ERROR: Se effectiveRegex è undefined in batch mode, mostra errore
      if (!effectiveRegex && enabledMethods.regex) {
        console.error('[TEST] ❌ ERROR - regex is undefined in batch mode!', {
          idx,
          phrase,
          'profile.regex': profile.regex,
          'node.nlpProfile.regex': node?.nlpProfile?.regex,
          'message': 'This means contract and profile are NOT synced!'
        });
        // ✅ Ritorna risultato con errore
        const errorSummary = '❌ ERROR: regex not synced';
        regexRes = { value: '', spans: [], summary: errorSummary, extractedGroups: {} };
      } else if (effectiveRegex) {
        try {
          // ✅ Usa exec() con flag 'g' per trovare TUTTI i match possibili
          // Il regex potrebbe matchare solo una parte della stringa (es. solo '12' invece di '12 3 1980')
          // Quindi cerchiamo TUTTI i match e prendiamo il più lungo che contiene tutti i gruppi
          const re = new RegExp(effectiveRegex, 'g');
          let bestMatch: RegExpExecArray | null = null;
          let longestMatch = '';
          let match: RegExpExecArray | null;

          // Reset lastIndex per assicurarsi di iniziare dall'inizio
          re.lastIndex = 0;

          // Trova tutti i match e prendi il più lungo
          while ((match = re.exec(phrase)) !== null) {
            if (match[0].length > longestMatch.length) {
              longestMatch = match[0];
              bestMatch = match;
            }
          }

          // Se non abbiamo trovato match con flag 'g', prova senza flag (match globale)
          if (!bestMatch) {
            const reNoG = new RegExp(effectiveRegex);
            const m = phrase.match(reNoG);
            if (m && m[0].length > longestMatch.length) {
              bestMatch = m as RegExpExecArray;
              longestMatch = m[0];
            }
          }

          if (bestMatch) {
            value = bestMatch[0]; // ✅ Usa il match completo

            // Extract capture groups - processa TUTTI i gruppi in base alla posizione
            if (bestMatch.length > 1 && node) {
              const allSubs = [...(node.subSlots || []), ...(node.subData || [])];

              // ✅ Processa TUTTI i gruppi in base alla loro posizione (1, 2, 3, ...)
              // Anche se alcuni sono undefined, li mappiamo ai subData corrispondenti
              for (let i = 1; i < bestMatch.length; i++) {
                const groupValue = bestMatch[i];
                const subIndex = i - 1; // Group 1 -> subIndex 0 (Day), Group 2 -> subIndex 1 (Month), Group 3 -> subIndex 2 (Year)

                if (subIndex < allSubs.length) {
                  const sub = allSubs[subIndex];
                  const subLabel = String(sub.label || sub.name || '');
                  const standardKey = mapLabelToStandardKey(subLabel);

                  // ✅ Solo se il gruppo ha un valore, aggiungilo
                  if (groupValue !== undefined && groupValue !== null) {
                    const trimmedValue = String(groupValue).trim();
                    if (trimmedValue !== '') {
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
          // Regex error - silently fail
        }

        // ✅ Costruisci summary solo se abbiamo processato la regex
        const summary = Object.keys(extractedGroups).length > 0
          ? summarizeVars(extractedGroups, value)
          : (value ? `value=${value}` : '—');

        regexRes = { value, spans: [], summary, extractedGroups };
      } else {
        // ✅ Regex non abilitata o non disponibile
        regexRes = { value: '', spans: [], summary: '—', extractedGroups: {} };
      }
    } else {
      regexRes = extractRegexOnly(phrase);
    }
    const regexMs = Math.round(performance.now() - t0Regex);

    // ✅ Un solo setRowResults per riga
    // ✅ Durante batch, NON salvare spans per evitare accumulo di elementi React
    // ✅ React batching automatico gestisce gli aggiornamenti senza bloccare l'UI
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

    // ✅ Solo per test singoli (non batch), aggiorna testing state
    if (!isBatch) {
      setSelectedRow(idx);
      testingRef.current = false;
      setTesting(false);
      testingState.stopTesting();
    }
  }, [examplesList, enabledMethods, extractRegexOnly, mapKindToField, node, getEffectiveRegex, summarizeVars]);

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
        // ✅ FASE 2 - OPTIMIZATION: Use Zustand store directly
        const gt = cellOverridesStore.getOverride(rowIdx, 'det', kKey);
        if (typeof gt === 'undefined') return;
        totalGt += 1;
        const pred = det[kKey] ?? ner[kKey] ?? llm[kKey];
        if (!pred) return;
        if (pred === gt) matched += 1; else falseAccept += 1;
      });
    });
    return { matched, falseAccept, totalGt };
  }, [examplesList, kind, rowResults, cellOverridesStore, expectedKeysForKind]);

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

