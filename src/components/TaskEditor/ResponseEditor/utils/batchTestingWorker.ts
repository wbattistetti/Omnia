// ✅ Pure batch testing logic - NO React, NO UI updates
// This worker executes tests without touching React state, preventing re-renders

import { extractField } from '../../../../nlp/pipeline';
import nlpTypesConfig from '../../../../../config/nlp-types.json';
import { mapLabelToStandardKey } from '../hooks/useRegexValidation';
import type { RowResult } from '../hooks/useExtractionTesting';

interface NLPProfile {
  regex?: string;
}

interface BatchTestingOptions {
  signal?: AbortSignal;
  enabledMethods?: {
    regex: boolean;
    deterministic: boolean;
    ner: boolean;
    llm: boolean;
  };
}

// Helper functions (same as useExtractionTesting)
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
  const varsStr = entries.map(([k, v]) => `${k}=${v}`).join(', ');
  return fallbackValue ? `value=${fallbackValue}, ${varsStr}` : varsStr;
}

function findAllOccurrences(text: string, sub: string): Array<{ start: number; end: number }> {
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
}

function mergeSpans(a: Array<{ start: number; end: number }>, b: Array<{ start: number; end: number }>) {
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
}

const italianMonths = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre','gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

function spansFromDate(phrase: string, v?: { day?: any; month?: any; year?: any }) {
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
}

function spansFromScalar(phrase: string, value?: any) {
  const v = (value == null ? '' : String(value)).trim();
  if (!v) return [] as Array<{ start: number; end: number }>;
  return findAllOccurrences(phrase, v);
}

function summarizeResult(result: any, currentField: string): string {
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
    console.error('[batchTestingWorker] summarizeResult error:', error, { result, currentField });
    return "—";
  }
}

function mapKindToField(kind: string, synonymsText: string, formatText: string, examplesList: string[]): string {
  const s = (kind || '').toLowerCase();

  if (s === 'number') {
    const synonyms = toCommaList(fromCommaList(synonymsText)).toLowerCase();
    const examplesText = (examplesList || []).join(' ').toLowerCase();
    const hasAgeWords = /(età|age|anni|vecchio|giovane)/i.test(synonyms);
    const hasAgeExamples = /(18|21|30|40|50|60|70|80|90|100)/.test(examplesText);
    if (hasAgeWords || hasAgeExamples) {
      return 'age';
    }
  }

  const extractorMapping = nlpTypesConfig.extractorMapping as Record<string, string>;
  if (extractorMapping[s]) {
    return extractorMapping[s];
  }

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
      return 'dateOfBirth';
    }
  }
  return 'generic';
}

function extractRegexOnly(text: string, profile: NLPProfile, node?: any) {
  const spans: Array<{ start: number; end: number }> = [];
  let value = '';
  const extractedGroups: Record<string, any> = {};

  if (profile.regex) {
    try {
      const re = new RegExp(profile.regex, 'g');
      let m: RegExpExecArray | null;
      let matchCount = 0;
      while ((m = re.exec(text)) !== null) {
        matchCount++;
        spans.push({ start: m.index, end: m.index + m[0].length });
        if (!value) {
          value = m[0];

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
      }
    } catch (e) {
      // Regex error - silently fail
    }
  }

  const summary = Object.keys(extractedGroups).length > 0
    ? summarizeVars(extractedGroups, value)
    : (value ? `value=${value}` : '—');

  return { value, spans, summary, extractedGroups };
}

/**
 * Run a single test for one phrase - PURE function, NO React state
 * EXPORTED for use in single row tests
 */
export async function runSingleTest(
  phrase: string,
  kind: string,
  synonymsText: string,
  formatText: string,
  profile: NLPProfile,
  node: any,
  examplesList: string[],
  options: BatchTestingOptions
): Promise<RowResult> {
  if (options.signal?.aborted) {
    return { regex: '—', deterministic: '—', ner: '—', llm: '—' };
  }

  const result: RowResult = {
    running: true,
    detRunning: true,
    nerRunning: true,
    llmRunning: true,
    regex: '—',
    deterministic: '—',
    ner: '—',
    llm: '—',
  };

  // Regex (sync) - always runs
  const t0Regex = performance.now();
  const regexRes = extractRegexOnly(phrase, profile, node);
  result.regex = regexRes.summary;
  result.regexMs = Math.round(performance.now() - t0Regex);
  result.spans = regexRes.spans;

  const field = mapKindToField(kind, synonymsText, formatText, examplesList);

  // ✅ SINGLE CALL: extractField does everything (deterministic, ner, llm) - NO duplicates!
  // This matches the old working version that called extractField directly
  const extractTask = options.enabledMethods?.deterministic !== false ? (async () => {
    const t0 = performance.now();
    console.log('[BATCH_WORKER] Starting extractField', { field, phrase: phrase.substring(0, 30) });
    try {
      // ✅ Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('extractField timeout')), 10000);
      });

      console.log('[BATCH_WORKER] Calling extractField', { field });
      const finalResult = await Promise.race([
        extractField<any>(field, phrase),
        timeoutPromise
      ]) as any;

      console.log('[BATCH_WORKER] extractField completed', { field, hasResult: !!finalResult, hasAllResults: !!finalResult?.allResults });

      // ✅ Extract all results from extractField (it does deterministic, ner, llm internally)
      const detSummary = finalResult?.allResults?.deterministic ? summarizeResult(finalResult.allResults.deterministic, field) : "—";
      const nerSummary = finalResult?.allResults?.ner ? summarizeResult(finalResult.allResults.ner, field) : "—";
      const llmSummary = finalResult?.allResults?.llm ? summarizeResult(finalResult.allResults.llm, field) : "—";

      result.deterministic = detSummary;
      result.ner = nerSummary;
      result.llm = llmSummary;
      result.detMs = Math.round(performance.now() - t0);
      result.nerMs = Math.round(performance.now() - t0); // Same timing since extractField does both
      result.llmMs = Math.round(performance.now() - t0); // Same timing since extractField does both
      result.detRunning = false;
      result.nerRunning = false;
      result.llmRunning = false;
      console.log('[BATCH_WORKER] extractField completed', { field, duration: result.detMs });
    } catch (e) {
      console.error('[BATCH_WORKER] extractField error', { field, error: e });
      result.deterministic = '—';
      result.ner = '—';
      result.llm = '—';
      result.detMs = Math.round(performance.now() - t0);
      result.nerMs = Math.round(performance.now() - t0);
      result.llmMs = Math.round(performance.now() - t0);
      result.detRunning = false;
      result.nerRunning = false;
      result.llmRunning = false;
    }
  })() : Promise.resolve();

  console.log('[BATCH_WORKER] Waiting for extractField to complete', { field });
  await extractTask;
  console.log('[BATCH_WORKER] extractField completed', { field });

  result.running = false;
  console.log('[BATCH_WORKER] runSingleTest returning', { field, hasResult: !!result });
  return result;
}

/**
 * Run batch tests for all phrases - PURE function, NO React state
 * Returns all results at once, without touching UI
 */
export async function runBatchTests(
  examplesList: string[],
  kind: string,
  synonymsText: string,
  formatText: string,
  profile: NLPProfile,
  node: any,
  options: BatchTestingOptions = {}
): Promise<RowResult[]> {
  console.log('[BATCH_WORKER] START', { count: examplesList.length });

  const results: RowResult[] = [];
  const enabledMethods = options.enabledMethods || {
    regex: true,
    deterministic: true,
    ner: true,
    llm: true,
  };

  const startTime = performance.now();

  for (let i = 0; i < examplesList.length; i += 1) {
    // ✅ Check if aborted
    if (options.signal?.aborted) {
      console.log('[BATCH_WORKER] ABORTED', { at: i, total: examplesList.length });
      // Fill remaining with empty results
      while (results.length < examplesList.length) {
        results.push({ regex: '—', deterministic: '—', ner: '—', llm: '—' });
      }
      break;
    }

    const phrase = examplesList[i] || '';
    if (!phrase) {
      results.push({ regex: '—', deterministic: '—', ner: '—', llm: '—' });
      continue;
    }

    console.log('[BATCH_WORKER] Testing phrase', { index: i, total: examplesList.length, phrase: phrase.substring(0, 30) });

    try {
      // ✅ Add per-phrase timeout to prevent infinite hangs
      const phraseTimeout = new Promise<RowResult>((_, reject) => {
        setTimeout(() => {
          console.error('[BATCH_WORKER] Phrase timeout', { index: i, phrase: phrase.substring(0, 30) });
          reject(new Error(`Phrase ${i} timeout after 15s`));
        }, 15000);
      });

      // ✅ Run test WITH timeout protection
      const result = await Promise.race([
        runSingleTest(
          phrase,
          kind,
          synonymsText,
          formatText,
          profile,
          node,
          examplesList,
          { ...options, enabledMethods }
        ),
        phraseTimeout
      ]);

      console.log('[BATCH_WORKER] Phrase completed', { index: i, hasResult: !!result });
      results.push(result);
    } catch (e) {
      console.error('[BATCH_WORKER] Error in runSingleTest', { index: i, error: e, errorMessage: e instanceof Error ? e.message : String(e) });
      // ✅ Fill with empty result on error/timeout
      results.push({ regex: '—', deterministic: '—', ner: '—', llm: '—' });
    }
  }

  const duration = Math.round(performance.now() - startTime);
  console.log('[BATCH_WORKER] END', { count: results.length, duration: `${duration}ms` });

  return results;
}
