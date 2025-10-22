import { registry } from './index';
import { THRESHOLDS } from './thresholds';
import type { SlotDecision } from './types';
import { nerExtract } from './services/nerClient';
import { mapFieldToExtractor } from './fieldMapper';

export async function extractField<T>(field: string, text: string, prev?: Partial<T>): Promise<SlotDecision<T>> {
  const extractorName = await mapFieldToExtractor(field);
  const ex = registry[extractorName];
  
  if (!ex) return { status: 'reject', reasons: ['unknown-field'] } as any;

  // eslint-disable-next-line no-console
  console.log('[NLP][pipeline] start', { field, text, extractorName });
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


