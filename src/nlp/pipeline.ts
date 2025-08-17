import { registry } from './index';
import { THRESHOLDS } from './thresholds';
import type { SlotDecision } from './types';
import { nerExtract } from './services/nerClient';

export async function extractField<T>(field: string, text: string, prev?: Partial<T>): Promise<SlotDecision<T>> {
  const ex = registry[field];
  if (!ex) return { status: 'reject', reasons: ['unknown-field'] } as any;

  const r = ex.extract(text, prev);
  if (r.value && r.confidence >= THRESHOLDS.minAccept && ex.validate(r.value as any).ok) {
    return { status: 'accepted', value: r.value as any, source: 'deterministic', confidence: r.confidence };
  }

  try {
    const ner = await nerExtract<T>(field, text);
    for (const c of ner.candidates || []) {
      if (ex.validate(c.value as any).ok && c.confidence >= THRESHOLDS.minAfterNer) {
        return { status: 'accepted', value: c.value as any, source: 'ner', confidence: c.confidence };
      }
    }
  } catch {}

  if (r.missing?.length) {
    return { status: 'ask-more', missing: r.missing, hint: r.reasons?.join(','), value: r.value as any, confidence: r.confidence } as any;
  }
  return { status: 'reject', reasons: r.reasons ?? ['low-confidence'] } as any;
}


