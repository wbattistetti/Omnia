import type { DataExtractor } from '../types';
import { normalizeText } from './base';

export type GenericValue = string | number;

/**
 * Generic extractor for numbers and text
 * Tries to extract numbers first, then falls back to text
 */
export const genericExtractor: DataExtractor<GenericValue> = {
  extract(text) {
    const raw = String(text || '').trim();
    if (!raw) {
      return { confidence: 0, reasons: ['empty-input'] };
    }

    const norm = normalizeText(raw);
    
    // Try to extract a number
    const numberMatch = norm.match(/-?\d+(?:[.,]\d+)?/);
    if (numberMatch) {
      const numStr = numberMatch[0].replace(',', '.');
      const numValue = parseFloat(numStr);
      if (!isNaN(numValue)) {
        console.log('[NLP][generic][extract] Extracted number', { raw, value: numValue });
        return { value: numValue, confidence: 0.85 };
      }
    }

    // Fallback: return the text as-is
    console.log('[NLP][generic][extract] Extracted text', { raw, value: raw });
    return { value: raw, confidence: 0.6 };
  },

  validate(v) {
    // Accept any non-null/non-undefined value
    const ok = v !== null && v !== undefined && String(v).trim() !== '';
    console.log('[NLP][generic][validate]', { input: v, valid: ok });
    return ok ? { ok: true } : { ok: false, errors: ['empty-value'] };
  },

  format(v) {
    console.log('[NLP][generic][format]', { value: v });
    return String(v);
  }
};


