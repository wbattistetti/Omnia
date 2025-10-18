import type { DataExtractor } from '../types';
import { normalizeText } from './base';

/**
 * Extracts numeric values (integers or decimals)
 * For age, quantity, count, etc. (not currency)
 */
export const numberExtractor: DataExtractor<number> = {
  extract(text) {
    const raw = String(text || '').trim();
    if (!raw) {
      return { confidence: 0, reasons: ['empty-input'] };
    }

    const norm = normalizeText(raw);
    
    // Extract number (integer or decimal)
    // Matches: -5, 42, 3.14, 1,234.56, etc.
    const numberMatch = norm.match(/-?\d+(?:[.,]\d+)?/);
    if (numberMatch) {
      const numStr = numberMatch[0].replace(',', '.');
      const numValue = parseFloat(numStr);
      if (!isNaN(numValue)) {
        console.log('[NLP][number][extract] Extracted number', { raw, value: numValue });
        return { value: numValue, confidence: 0.9 };
      }
    }

    // No valid number found
    console.log('[NLP][number][extract] No valid number found', { raw });
    return { confidence: 0, reasons: ['not-a-number'] };
  },

  validate(v) {
    // Must be a valid number
    const ok = typeof v === 'number' && !isNaN(v) && isFinite(v);
    console.log('[NLP][number][validate]', { input: v, valid: ok });
    return ok ? { ok: true } : { ok: false, errors: ['invalid-number'] };
  },

  format(v) {
    console.log('[NLP][number][format]', { value: v });
    // Return as string, preserving decimals if present
    return Number.isInteger(v) ? v.toString() : v.toFixed(2);
  }
};

