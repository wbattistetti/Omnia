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
  if (r.value && r.confidence >= THRESHOLDS.minAccept && ex.validate(r.value as any).ok) {
    // eslint-disable-next-line no-console
    console.log('[NLP][pipeline] accepted deterministic', { field, confidence: r.confidence });
    return { status: 'accepted', value: r.value as any, source: 'deterministic', confidence: r.confidence };
  }

  try {
    const ner = await nerExtract<T>(field, text);
    // eslint-disable-next-line no-console
    console.log('[NLP][pipeline] ner', { field, candidates: (ner.candidates || []).length });
    for (const c of ner.candidates || []) {
      if (ex.validate(c.value as any).ok && c.confidence >= THRESHOLDS.minAfterNer) {
        // eslint-disable-next-line no-console
        console.log('[NLP][pipeline] accepted ner', { field, confidence: c.confidence });
        return { status: 'accepted', value: c.value as any, source: 'ner', confidence: c.confidence };
      }
    }
  } catch {}

  if (r.missing?.length) {
    return { status: 'ask-more', missing: r.missing, hint: r.reasons?.join(','), value: r.value as any, confidence: r.confidence } as any;
  }
  // eslint-disable-next-line no-console
  console.log('[NLP][pipeline] reject', { field, reasons: r.reasons });
  return { status: 'reject', reasons: r.reasons ?? ['low-confidence'] } as any;
}


