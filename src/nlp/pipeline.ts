import { registry } from './index';
import { THRESHOLDS } from './thresholds';
import type { SlotDecision } from './types';
import { nerExtract } from './services/nerClient';
import { mapFieldToExtractor } from './fieldMapper';

export interface ExtractionContext {
  node?: {
    subData?: any[];
    subSlots?: any[];
    kind?: string;
    label?: string;
  };
  regex?: string;
}

/**
 * Structural parser: derives parsing logic from subSlots/subData labels, not hardcoded types
 * Tries to parse complete value using regex for composite types (with subData/subSlots)
 * Returns parsed value if successful, null otherwise
 */
function tryParseComplete<T>(text: string, regex: string | undefined, node: ExtractionContext['node']): Partial<T> | null {
  console.log('[NLP][tryParseComplete] START', {
    text,
    hasRegex: !!regex,
    regex,
    hasNode: !!node,
    hasSubData: Array.isArray(node?.subData) && node.subData.length > 0,
    hasSubSlots: Array.isArray(node?.subSlots) && node.subSlots.length > 0,
    subDataCount: Array.isArray(node?.subData) ? node.subData.length : 0,
    subSlotsCount: Array.isArray(node?.subSlots) ? node.subSlots.length : 0
  });

  if (!regex || !node) {
    console.log('[NLP][tryParseComplete] EARLY EXIT: missing regex or node', { hasRegex: !!regex, hasNode: !!node });
    return null;
  }

  // Check if composite (has subData or subSlots)
  const isComposite = (Array.isArray(node.subData) && node.subData.length > 0) ||
                      (Array.isArray(node.subSlots) && node.subSlots.length > 0);
  if (!isComposite) {
    console.log('[NLP][tryParseComplete] EARLY EXIT: not composite', {
      subData: node.subData,
      subSlots: node.subSlots
    });
    return null;
  }

  try {
    console.log('[NLP][tryParseComplete] Attempting regex match...', { text, regex });
    const match = text.match(new RegExp(regex));
    if (!match) {
      console.log('[NLP][tryParseComplete] Regex match FAILED', { text, regex });
      return null;
    }

    console.log('[NLP][tryParseComplete] Regex match SUCCESS', { match: match[0], groups: match });
    const matchedValue = match[0] || match[1] || match[0]; // First captured group or full match
    console.log('[NLP][tryParseComplete] Matched value:', matchedValue);

    // Get all subSlots/subData labels and normalize them (structural approach)
    const allSubs = [...(node.subSlots || []), ...(node.subData || [])];
    console.log('[NLP][tryParseComplete] All subs:', allSubs.map(s => ({
      label: s?.label,
      name: s?.name,
      id: s?.id
    })));

    const labels = allSubs.map(s => String(s?.label || s?.name || '').toLowerCase());
    const normalized = labels.map(l => l.replace(/[^a-z0-9]+/g, ''));
    console.log('[NLP][tryParseComplete] Labels:', { labels, normalized });

    // Use standard extractor keys (day, month, year, firstname, lastname, etc.)
    // The engine will map these to subSlots using label normalization
    const result: Record<string, any> = {};

    // Structural detection: date pattern (day, month, year)
    const hasDay = normalized.some(l => l.includes('day') || l.includes('giorno'));
    const hasMonth = normalized.some(l => l.includes('month') || l.includes('mese'));
    const hasYear = normalized.some(l => l.includes('year') || l.includes('anno'));

    console.log('[NLP][tryParseComplete] Pattern detection:', {
      hasDay,
      hasMonth,
      hasYear,
      isDate: hasDay && hasMonth && hasYear
    });

    if (hasDay && hasMonth && hasYear) {
      console.log('[NLP][tryParseComplete] Detected DATE pattern, attempting parsing...');
      // Date parsing - try multiple formats
      const MONTHS: Record<string, number> = {
        gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3, aprile: 4, apr: 4,
        maggio: 5, mag: 5, giugno: 6, giu: 6, luglio: 7, lug: 7, agosto: 8, ago: 8,
        settembre: 9, set: 9, ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12,
        january: 1, jan: 1, february: 2, march: 3, april: 4, may: 5, june: 6, jun: 6,
        july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, october: 10, oct: 10,
        november: 11, december: 12, dec: 12
      };

      // Format 1: dd/mm/yyyy or dd-mm-yyyy
      let dateMatch = matchedValue.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      console.log('[NLP][tryParseComplete] Format 1 (dd/mm/yyyy) match:', dateMatch);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        let year = parseInt(dateMatch[3], 10);
        if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
        console.log('[NLP][tryParseComplete] Parsed date (format 1):', { day, month, year });
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          // Use standard extractor keys (engine will map to subSlots via labels)
          result.day = day;
          result.month = month;
          result.year = year;
          console.log('[NLP][tryParseComplete] SUCCESS: returning date result', result);
          return result as Partial<T>;
        } else {
          console.log('[NLP][tryParseComplete] Format 1 validation FAILED', { day, month, year });
        }
      }

      // Format 2: yyyy-mm-dd (ISO format)
      dateMatch = matchedValue.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      console.log('[NLP][tryParseComplete] Format 2 (yyyy-mm-dd) match:', dateMatch);
      if (dateMatch) {
        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        const day = parseInt(dateMatch[3], 10);
        console.log('[NLP][tryParseComplete] Parsed date (format 2):', { day, month, year });
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          result.day = day;
          result.month = month;
          result.year = year;
          console.log('[NLP][tryParseComplete] SUCCESS: returning date result', result);
          return result as Partial<T>;
        } else {
          console.log('[NLP][tryParseComplete] Format 2 validation FAILED', { day, month, year });
        }
      }

      // Format 3: dd month yyyy (e.g., "16 dicembre 1961")
      dateMatch = matchedValue.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{2,4})/i);
      console.log('[NLP][tryParseComplete] Format 3 (dd month yyyy) match:', dateMatch);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const monthName = dateMatch[2].toLowerCase();
        const month = MONTHS[monthName];
        let year = parseInt(dateMatch[3], 10);
        if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
        console.log('[NLP][tryParseComplete] Parsed date (format 3):', { day, month, monthName, year });
        if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          result.day = day;
          result.month = month;
          result.year = year;
          console.log('[NLP][tryParseComplete] SUCCESS: returning date result', result);
          return result as Partial<T>;
        } else {
          console.log('[NLP][tryParseComplete] Format 3 validation FAILED', { day, month, monthName, year });
        }
      }

      console.log('[NLP][tryParseComplete] All date formats FAILED for:', matchedValue);
    }

    // Structural detection: name pattern (firstname, lastname)
    const hasFirst = normalized.some(l => l.includes('first') || l.includes('nome'));
    const hasLast = normalized.some(l => l.includes('last') || l.includes('cognome') || l.includes('surname'));

    if (hasFirst && hasLast) {
      // Name parsing - "FirstName LastName" format
      const nameMatch = matchedValue.match(/^([A-Za-zÀ-ÿ'`-]+)\s+([A-Za-zÀ-ÿ'`-]+)$/);
      if (nameMatch) {
        // Use standard extractor keys (engine will map to subSlots via labels)
        result.firstname = nameMatch[1];
        result.lastname = nameMatch[2];
        return result as Partial<T>;
      }
    }

    // Add more structural patterns as needed (address, phone, etc.)
    // All based on subSlots/subData labels, not hardcoded types!

  } catch (e) {
    console.error('[NLP][pipeline] Error parsing complete value:', e);
  }

  console.log('[NLP][tryParseComplete] FINAL: returning null (no match found)');
  return null;
}

export async function extractField<T>(
  field: string,
  text: string,
  prev?: Partial<T>,
  context?: ExtractionContext
): Promise<SlotDecision<T>> {
  console.log('[NLP][extractField] START', {
    field,
    text,
    hasContext: !!context,
    hasNode: !!context?.node,
    hasRegex: !!context?.regex,
    regex: context?.regex,
    nodeKind: context?.node?.kind,
    nodeLabel: context?.node?.label
  });

  const extractorName = await mapFieldToExtractor(field);
  const ex = registry[extractorName];

  if (!ex) return { status: 'reject', reasons: ['unknown-field'] } as any;

  // 🎯 FULL-FIRST APPROACH: Try complete parsing first if composite type with regex
  if (context?.node && context.regex) {
    console.log('[NLP][extractField] Attempting full-first parsing...', {
      field,
      text,
      regex: context.regex,
      nodeLabel: context.node.label,
      subDataCount: Array.isArray(context.node.subData) ? context.node.subData.length : 0,
      subSlotsCount: Array.isArray(context.node.subSlots) ? context.node.subSlots.length : 0
    });

    const completeValue = tryParseComplete<T>(text, context.regex, context.node);
    console.log('[NLP][extractField] tryParseComplete result:', {
      hasValue: !!completeValue,
      value: completeValue,
      keys: completeValue ? Object.keys(completeValue) : []
    });

    if (completeValue && Object.keys(completeValue).length > 0) {
      console.log('[NLP][extractField] Validating complete value...', { value: completeValue });
      // Validate the complete value
      const validation = ex.validate(completeValue as any);
      console.log('[NLP][extractField] Validation result:', {
        ok: validation.ok,
        errors: validation.errors
      });

      if (validation.ok) {
        console.log('[NLP][pipeline] Complete value parsed from regex', { field, value: completeValue });
        return {
          status: 'accepted',
          value: completeValue as any,
          source: 'deterministic',
          confidence: 0.95,
          allResults: {
            deterministic: { status: 'accepted', value: completeValue, source: 'deterministic', confidence: 0.95 },
            ner: null,
            llm: null
          }
        } as any;
      } else {
        console.log('[NLP][extractField] Validation FAILED, continuing with normal extraction', {
          errors: validation.errors
        });
      }
    } else {
      console.log('[NLP][extractField] No complete value found, continuing with normal extraction');
    }
  } else {
    console.log('[NLP][extractField] Skipping full-first: missing context or regex', {
      hasContext: !!context,
      hasNode: !!context?.node,
      hasRegex: !!context?.regex
    });
  }

  // eslint-disable-next-line no-console
  console.log('[NLP][pipeline] start', { field, text, extractorName, hasContext: !!context });
  const r = ex.extract(text, prev);
  // eslint-disable-next-line no-console
  console.log('[NLP][pipeline] deterministic', { field, hasValue: Boolean(r.value), confidence: r.confidence, reasons: r.reasons });

  let deterministicResult = null;
  if (r.value && r.confidence >= THRESHOLDS.minAccept && ex.validate(r.value as any).ok) {
    // eslint-disable-next-line no-console
    console.log('[NLP][pipeline] accepted deterministic', { field, confidence: r.confidence });
    deterministicResult = { status: 'accepted', value: r.value as any, source: 'deterministic', confidence: r.confidence };
  }

  // Always try NER and LLM extraction even if deterministic succeeded
  let nerResult = null;
  let llmResult = null;

  // NER extraction
  try {
    const ner = await nerExtract<T>(field, text);
    // eslint-disable-next-line no-console
    console.log('[NLP][pipeline] ner', { field, candidates: (ner.candidates || []).length });
    for (const c of ner.candidates || []) {
      if (ex.validate(c.value as any).ok && c.confidence >= THRESHOLDS.minAfterNer) {
        // eslint-disable-next-line no-console
        console.log('[NLP][pipeline] accepted ner', { field, confidence: c.confidence });
        nerResult = { status: 'accepted', value: c.value as any, source: 'ner', confidence: c.confidence };
        break;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[NLP][pipeline] NER extraction failed:', e);
  }

  // LLM extraction
  try {
    const llmResponse = await fetch('/api/nlp/llm-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, text })
    });

    if (llmResponse.ok) {
      const llm = await llmResponse.json();
      // eslint-disable-next-line no-console
      console.log('[NLP][pipeline] llm', { field, candidates: (llm.candidates || []).length });

      for (const c of llm.candidates || []) {
        if (ex.validate(c.value as any).ok && c.confidence >= THRESHOLDS.minAfterNer) {
          // eslint-disable-next-line no-console
          console.log('[NLP][pipeline] accepted llm', { field, confidence: c.confidence });
          llmResult = { status: 'accepted', value: c.value as any, source: 'llm', confidence: c.confidence };
          break;
        }
      }
    } else {
      // eslint-disable-next-line no-console
      console.error('[NLP][pipeline] LLM extraction failed:', await llmResponse.text());
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[NLP][pipeline] LLM extraction error:', e);
  }

  // Return the best result based on confidence + all results for debugging
  const results = [deterministicResult, nerResult, llmResult].filter(Boolean);
  const bestResult = results.length > 0 ? results.reduce((best, current) =>
    (current.confidence > best.confidence) ? current : best
  ) : null;

  if (bestResult) {
    return {
      status: bestResult.status,
      value: bestResult.value,
      source: bestResult.source,
      confidence: bestResult.confidence,
      // Include all results for debugging and UI display
      allResults: {
        deterministic: deterministicResult,
        ner: nerResult,
        llm: llmResult
      }
    };
  }

  // If no extraction succeeded, check for missing fields
  if (r.missing?.length) {
    return {
      status: 'ask-more',
      missing: r.missing,
      hint: r.reasons?.join(','),
      value: r.value as any,
      confidence: r.confidence,
      allResults: {
        deterministic: deterministicResult,
        ner: nerResult,
        llm: llmResult
      }
    } as any;
  }

  // eslint-disable-next-line no-console
  console.log('[NLP][pipeline] reject', { field, reasons: r.reasons });
  return {
    status: 'reject',
    reasons: r.reasons ?? ['low-confidence'],
    allResults: {
      deterministic: deterministicResult,
      ner: nerResult,
      llm: llmResult
    }
  } as any;
}


