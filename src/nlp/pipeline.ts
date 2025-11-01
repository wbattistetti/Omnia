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
  if (!regex || !node) {
    return null;
  }

  // Check if composite (has subData or subSlots)
  const isComposite = (Array.isArray(node.subData) && node.subData.length > 0) ||
                      (Array.isArray(node.subSlots) && node.subSlots.length > 0);
  if (!isComposite) {
    return null;
  }

  try {
    const match = text.match(new RegExp(regex));
    if (!match) {
      return null;
    }

    const matchedValue = match[0] || match[1] || match[0]; // First captured group or full match

    // Get all subSlots/subData labels and normalize them (structural approach)
    const allSubs = [...(node.subSlots || []), ...(node.subData || [])];

    const labels = allSubs.map(s => String(s?.label || s?.name || '').toLowerCase());
    const normalized = labels.map(l => l.replace(/[^a-z0-9]+/g, ''));

    // Use standard extractor keys (day, month, year, firstname, lastname, etc.)
    // The engine will map these to subSlots using label normalization
    const result: Record<string, any> = {};

    // Structural detection: date pattern (day, month, year)
    const hasDay = normalized.some(l => l.includes('day') || l.includes('giorno'));
    const hasMonth = normalized.some(l => l.includes('month') || l.includes('mese'));
    const hasYear = normalized.some(l => l.includes('year') || l.includes('anno'));

    if (hasDay && hasMonth && hasYear) {
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
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        let year = parseInt(dateMatch[3], 10);
        if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          // Use standard extractor keys (engine will map to subSlots via labels)
          result.day = day;
          result.month = month;
          result.year = year;
          return result as Partial<T>;
        }
      }

      // Format 2: yyyy-mm-dd (ISO format)
      dateMatch = matchedValue.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (dateMatch) {
        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        const day = parseInt(dateMatch[3], 10);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          result.day = day;
          result.month = month;
          result.year = year;
          return result as Partial<T>;
        }
      }

      // Format 3: dd month yyyy (e.g., "16 dicembre 1961")
      dateMatch = matchedValue.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{2,4})/i);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const monthName = dateMatch[2].toLowerCase();
        const month = MONTHS[monthName];
        let year = parseInt(dateMatch[3], 10);
        if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
        if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          result.day = day;
          result.month = month;
          result.year = year;
          return result as Partial<T>;
        }
      }
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
    // Error parsing complete value - return null
  }

  return null;
}

export async function extractField<T>(
  field: string,
  text: string,
  prev?: Partial<T>,
  context?: ExtractionContext
): Promise<SlotDecision<T>> {
  // Removed verbose logging

  const extractorName = await mapFieldToExtractor(field);
  const ex = registry[extractorName];

  if (!ex) return { status: 'reject', reasons: ['unknown-field'] } as any;

  // 🎯 FULL-FIRST APPROACH: Try complete parsing first if composite type with regex
  if (context?.node && context.regex) {
    const completeValue = tryParseComplete<T>(text, context.regex, context.node);

    if (completeValue && Object.keys(completeValue).length > 0) {
      // Validate the complete value
      const validation = ex.validate(completeValue as any);

      if (validation.ok) {
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
      }
    }
  }

  const r = ex.extract(text, prev);

  let deterministicResult = null;
  if (r.value && r.confidence >= THRESHOLDS.minAccept && ex.validate(r.value as any).ok) {
    deterministicResult = { status: 'accepted', value: r.value as any, source: 'deterministic', confidence: r.confidence };
  }

  // Always try NER and LLM extraction even if deterministic succeeded
  let nerResult = null;
  let llmResult = null;

  // NER extraction
  try {
    const ner = await nerExtract<T>(field, text);
    for (const c of ner.candidates || []) {
      if (ex.validate(c.value as any).ok && c.confidence >= THRESHOLDS.minAfterNer) {
        nerResult = { status: 'accepted', value: c.value as any, source: 'ner', confidence: c.confidence };
        break;
      }
    }
  } catch (e) {
    // NER extraction failed - silently continue
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

      for (const c of llm.candidates || []) {
        if (ex.validate(c.value as any).ok && c.confidence >= THRESHOLDS.minAfterNer) {
          llmResult = { status: 'accepted', value: c.value as any, source: 'llm', confidence: c.confidence };
          break;
        }
      }
    }
  } catch (e) {
    // LLM extraction error - silently continue
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

  // No extraction succeeded - rejecting
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


