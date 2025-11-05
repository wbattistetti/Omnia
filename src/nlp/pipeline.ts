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
 * Maps sub-data label to standard English field key
 * Returns standard keys: day, month, year, firstname, lastname, etc.
 */
function mapLabelToStandardKey(label: string): string | null {
  const normalized = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  // Date components
  if (normalized.includes('day') || normalized.includes('giorno')) return 'day';
  if (normalized.includes('month') || normalized.includes('mese')) return 'month';
  if (normalized.includes('year') || normalized.includes('anno')) return 'year';

  // Name components
  if (normalized.includes('first') || normalized.includes('nome') || normalized.includes('firstname')) return 'firstname';
  if (normalized.includes('last') || normalized.includes('cognome') || normalized.includes('surname') || normalized.includes('lastname')) return 'lastname';

  // Address components (if needed)
  if (normalized.includes('street') || normalized.includes('via') || normalized.includes('indirizzo')) return 'street';
  if (normalized.includes('city') || normalized.includes('citta') || normalized.includes('comune')) return 'city';
  if (normalized.includes('zip') || normalized.includes('cap') || normalized.includes('postal')) return 'zip';
  if (normalized.includes('country') || normalized.includes('nazione') || normalized.includes('paese')) return 'country';

  return null;
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

  // ✅ If input text is empty, don't even attempt regex match
  if (!text || text.trim().length === 0) {
    console.log('[NLP][tryParseComplete][empty-input]', { text, regex });
    return null;
  }

  try {
    const match = text.match(new RegExp(regex));
    if (!match) {
      console.log('[NLP][tryParseComplete][no-match]', { text, regex });
      return null;
    }

    console.log('[NLP][tryParseComplete][matched]', { text, regex, match: match[0], groups: match.slice(1) });

    // Get all sub-data/subSlots with their IDs and labels
    const allSubs = [...(node.subSlots || []), ...(node.subData || [])];
    console.log('[NLP][tryParseComplete][subs-info]', {
      subsCount: allSubs.length,
      subs: allSubs.map(s => ({ label: s.label || s.name, id: s.id || s._id }))
    });

    // ✅ Get ALL capture groups (including undefined for optional groups)
    // Skip full match at index 0, but preserve undefined values to track which groups are missing
    const allCaptureGroups = match.slice(1);
    const nonEmptyGroups = allCaptureGroups.filter(g => g !== undefined && g !== null && String(g).trim().length > 0);
    console.log('[NLP][tryParseComplete][capture-groups]', {
      rawGroups: allCaptureGroups,
      nonEmptyGroups,
      nonEmptyCount: nonEmptyGroups.length,
      totalGroups: allCaptureGroups.length,
      expectedCount: allSubs.length,
      hasPartialMatch: nonEmptyGroups.length > 0 && nonEmptyGroups.length < allSubs.length
    });

    // ✅ FIRST PRIORITY: Use numeric capture groups (even if partial match)
    // Allow partial matches: if we have at least one valid group, extract what we can
    if (nonEmptyGroups.length > 0 && allCaptureGroups.length <= allSubs.length) {
      const result: Record<string, any> = {};
      let hasValidMapping = false;

      // Map each capture group (by position) to sub-data (by order)
      // Iterate over ALL expected sub-data, but only map groups that exist
      for (let i = 0; i < allSubs.length; i++) {
        const subData = allSubs[i];
        if (!subData) continue;

        // Get the capture group at position i (may be undefined if optional group didn't match)
        const groupValue = allCaptureGroups[i];

        // If this group is undefined/null/empty, skip it (this sub-data is missing)
        if (groupValue === undefined || groupValue === null || String(groupValue).trim().length === 0) {
          console.log('[NLP][tryParseComplete][missing-group]', {
            index: i,
            subLabel: subData.label || subData.name,
            reason: 'Optional group did not match or is empty'
          });
          continue;
        }

        const trimmedValue = String(groupValue).trim();

        // Get sub-data ID and label
        const subId = subData.id || subData._id || '';
        const subLabel = String(subData.label || subData.name || '');

        // Map label to standard key (day, month, year, firstname, lastname, etc.)
        const standardKey = mapLabelToStandardKey(subLabel);
        console.log('[NLP][tryParseComplete][mapping-group]', {
          index: i,
          groupValue: trimmedValue,
          subLabel,
          standardKey,
          subId
        });

        if (standardKey) {
          // Use standard key (day, month, year, etc.)
          if (standardKey === 'day' || standardKey === 'month' || standardKey === 'year') {
            let numValue = parseInt(trimmedValue, 10);
            // Normalize 2-digit years to 4 digits (61 -> 1961, 05 -> 2005)
            if (standardKey === 'year' && !isNaN(numValue)) {
              if (numValue < 100) {
                numValue = numValue < 50 ? 2000 + numValue : 1900 + numValue;
              }
            }
            console.log('[NLP][tryParseComplete][parsing-date-value]', {
              standardKey,
              groupValue: trimmedValue,
              numValue,
              isValid: !isNaN(numValue),
              wasNormalized: standardKey === 'year' && parseInt(trimmedValue, 10) < 100
            });
            if (!isNaN(numValue)) {
              result[standardKey] = numValue;
              hasValidMapping = true;
            }
          } else if (standardKey === 'firstname' || standardKey === 'lastname') {
            result[standardKey] = trimmedValue;
            hasValidMapping = true;
          } else {
            // Other standard keys (street, city, zip, country)
            result[standardKey] = trimmedValue;
            hasValidMapping = true;
          }
        } else {
          // No standard mapping found - store with sub-data ID as key for fallback
          // But prefer to use standard keys when possible
          const fallbackKey = subLabel.toLowerCase().replace(/[^a-z0-9]+/g, '');
          if (fallbackKey) {
            result[fallbackKey] = trimmedValue;
            hasValidMapping = true;
          }
        }
      }

      console.log('[NLP][tryParseComplete][mapping-result]', {
        result,
        hasValidMapping,
        resultKeys: Object.keys(result),
        extractedGroups: Object.keys(result),
        rawGroups: allCaptureGroups.map(g => g !== undefined ? String(g) : 'undefined'),
        nonEmptyGroups: nonEmptyGroups.map(g => String(g)),
        subDataCount: allSubs.length,
        totalGroups: allCaptureGroups.length,
        nonEmptyCount: nonEmptyGroups.length,
        isPartialMatch: nonEmptyGroups.length < allSubs.length
      });

      if (hasValidMapping && Object.keys(result).length > 0) {
        console.log('[NLP][tryParseComplete][groups-mapped-to-subdata]', {
          result,
          extractedKeys: Object.keys(result),
          nonEmptyGroups: nonEmptyGroups.map(g => String(g)),
          subDataCount: allSubs.length,
          nonEmptyGroupsCount: nonEmptyGroups.length,
          totalGroupsCount: allCaptureGroups.length
        });
        return result as Partial<T>;
      }
    }

    // Fallback to existing parsing logic (current behavior)
    const matchedValue = match[0] || match[1] || match[0]; // First captured group or full match

    // Get all subSlots/subData labels and normalize them (structural approach)
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
      // Date parsing - try multiple formats (both complete and partial)
      const MONTHS: Record<string, number> = {
        gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3, aprile: 4, apr: 4,
        maggio: 5, mag: 5, giugno: 6, giu: 6, luglio: 7, lug: 7, agosto: 8, ago: 8,
        settembre: 9, set: 9, ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12,
        january: 1, jan: 1, february: 2, march: 3, april: 4, may: 5, june: 6, jun: 6,
        july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, october: 10, oct: 10,
        november: 11, december: 12, dec: 12
      };

      // Format 1: dd/mm/yyyy or dd-mm-yyyy (complete)
      let dateMatch = matchedValue.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        let year = parseInt(dateMatch[3], 10);
        if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          result.day = day;
          result.month = month;
          result.year = year;
          return result as Partial<T>;
        }
      }

      // Format 1 partial: dd/mm or dd-mm (missing year)
      dateMatch = matchedValue.match(/(\d{1,2})[\/\-](\d{1,2})(?:\s|$)/);
      if (dateMatch && !result.day && !result.month) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          result.day = day;
          result.month = month;
          // Year is missing - will be handled by ask-more
        }
      }

      // Format 2: yyyy-mm-dd (ISO format - complete)
      dateMatch = matchedValue.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (dateMatch && Object.keys(result).length === 0) {
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

      // Format 3: dd month yyyy (complete)
      dateMatch = matchedValue.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{2,4})/i);
      if (dateMatch && Object.keys(result).length === 0) {
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

      // Format 3 partial: dd month (missing year)
      dateMatch = matchedValue.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)(?:\s|$)/i);
      if (dateMatch && Object.keys(result).length === 0) {
        const day = parseInt(dateMatch[1], 10);
        const monthName = dateMatch[2].toLowerCase();
        const month = MONTHS[monthName];
        if (month && day >= 1 && day <= 31) {
          result.day = day;
          result.month = month;
          // Year is missing - will be handled by ask-more
        }
      }

      // If we have any partial result, return it (will trigger ask-more)
      if (Object.keys(result).length > 0) {
        return result as Partial<T>;
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

  // Use context.node.kind if available (avoids database lookup), otherwise fallback to mapFieldToExtractor
  let extractorName: string;
  if (context?.node?.kind) {
    // Map common kind values to extractor names
    const kindMap: Record<string, string> = {
      'date': 'dateOfBirth',
      'dateOfBirth': 'dateOfBirth',
      'email': 'email',
      'phone': 'phone',
      'number': 'number',
      'generic': 'generic'
    };
    extractorName = kindMap[context.node.kind] || context.node.kind;
    console.log('[NLP][extractField][using-context-kind]', {
      field,
      nodeKind: context.node.kind,
      extractorName
    });
  } else {
    try {
      extractorName = await mapFieldToExtractor(field);
    } catch (error) {
      // If database lookup fails, fallback to generic
      console.warn('[NLP][extractField][mapFieldToExtractor-failed]', {
        field,
        error: error instanceof Error ? error.message : String(error),
        fallingBackToGeneric: true
      });
      extractorName = 'generic';
    }
  }

  const ex = registry[extractorName];

  if (!ex) {
    console.error('[NLP][extractField][extractor-not-found]', {
      extractorName,
      availableExtractors: Object.keys(registry)
    });
    return { status: 'reject', reasons: ['unknown-field'] } as any;
  }

  // 🎯 FULL-FIRST APPROACH: Try complete parsing first if composite type with regex
  console.log('[NLP][extractField][entry]', {
    field,
    text,
    hasContext: !!context,
    hasContextNode: !!context?.node,
    hasContextRegex: !!context?.regex,
    contextRegex: context?.regex,
    contextNodeLabel: context?.node?.label,
    contextNodeKind: context?.node?.kind,
    contextNodeSubData: context?.node?.subData,
    contextNodeSubSlots: context?.node?.subSlots,
    willTryParseComplete: !!(context?.node && context.regex)
  });

  if (context?.node && context.regex) {
    console.log('[NLP][extractField][calling-tryParseComplete]', {
      text,
      regex: context.regex,
      nodeLabel: context.node.label
    });
    const parsedValue = tryParseComplete<T>(text, context.regex, context.node);
    console.log('[NLP][extractField][tryParseComplete-result]', {
      text,
      hasParsedValue: !!parsedValue,
      parsedValue,
      parsedValueKeys: parsedValue ? Object.keys(parsedValue) : []
    });

    if (parsedValue && Object.keys(parsedValue).length > 0) {
      // Ensure values are numbers for date validation
      const normalizedValue = { ...parsedValue };
      if ('day' in normalizedValue && typeof normalizedValue.day !== 'number') {
        normalizedValue.day = parseInt(String(normalizedValue.day), 10);
      }
      if ('month' in normalizedValue && typeof normalizedValue.month !== 'number') {
        normalizedValue.month = parseInt(String(normalizedValue.month), 10);
      }
      if ('year' in normalizedValue && typeof normalizedValue.year !== 'number') {
        let year = parseInt(String(normalizedValue.year), 10);
        // Normalize 2-digit years to 4 digits (61 -> 1961, 05 -> 2005)
        if (!isNaN(year) && year < 100) {
          year = year < 50 ? 2000 + year : 1900 + year;
        }
        normalizedValue.year = year;
      }
      console.log('[NLP][extractField][normalized-value]', {
        original: parsedValue,
        normalized: normalizedValue,
        day: normalizedValue.day,
        month: normalizedValue.month,
        year: normalizedValue.year
      });

      // Validate the parsed value
      console.log('[NLP][extractField][calling-validate]', {
        normalizedValue,
        extractorName: ex.name
      });
      const validation = ex.validate(normalizedValue as any);
      console.log('[NLP][extractField][validation-result]', {
        validationOk: validation.ok,
        validationErrors: validation.errors,
        normalizedValue
      });

      if (validation.ok) {
        // Complete value parsed and validated successfully
        console.log('[NLP][extractField][regex-accepted]', {
          text,
          parsedValue,
          normalizedValue,
          field
        });
        return {
          status: 'accepted',
          value: normalizedValue as any,
          source: 'deterministic',
          confidence: 0.95,
          allResults: {
            deterministic: { status: 'accepted', value: normalizedValue, source: 'deterministic', confidence: 0.95 },
            ner: null,
            llm: null
          }
        } as any;
      } else {
        // Regex matched but validation failed - check if partial value can be used
        // Get all expected fields from subData/subSlots
        const allSubs = [...(context.node.subSlots || []), ...(context.node.subData || [])];
        const expectedFields = allSubs.map(s => String(s?.label || s?.name || '').toLowerCase());

        // Check which fields are present and which are missing
        const parsedKeys = Object.keys(normalizedValue).map(k => k.toLowerCase());
        const missingFields = expectedFields.filter(field => {
          const normalizedField = field.replace(/[^a-z0-9]+/g, '');
          return !parsedKeys.some(key => key.includes(normalizedField) || normalizedField.includes(key));
        });

        // Debug log for validation failure
        console.log('[NLP][extractField][regex-validation-failed]', {
          text,
          parsedValue,
          normalizedValue,
          validationErrors: validation.errors,
          missingFields,
          expectedFields,
          parsedKeys
        });

        if (missingFields.length > 0) {
          // Partial match: some fields are missing, ask for them
          return {
            status: 'ask-more',
            value: normalizedValue as any,
            missing: missingFields,
            hint: `Missing: ${missingFields.join(', ')}`,
            confidence: 0.8,
            source: 'deterministic',
            allResults: {
              deterministic: { status: 'ask-more', value: normalizedValue, source: 'deterministic', confidence: 0.8 },
              ner: null,
              llm: null
            }
          } as any;
        } else {
          // All fields present but validation failed - this is an invalid value
          // Return reject instead of continuing with other extractors
          // This ensures we don't fall through to escalation when regex matched correctly
          return {
            status: 'reject',
            reasons: validation.errors || ['invalid-value'],
            value: normalizedValue as any,
            allResults: {
              deterministic: { status: 'reject', value: normalizedValue, source: 'deterministic', confidence: 0.8 },
              ner: null,
              llm: null
            }
          } as any;
        }
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


