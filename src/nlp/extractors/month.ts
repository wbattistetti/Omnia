import type { DataExtractor } from '../types';

/**
 * Month extractor
 * Accepts numeric (1-12) or textual (January, gennaio, etc.) month input
 * Always outputs numeric format (1-12)
 */

const MONTHS_IT: Record<string, number> = {
  'gennaio': 1, 'gen': 1,
  'febbraio': 2, 'feb': 2,
  'marzo': 3, 'mar': 3,
  'aprile': 4, 'apr': 4,
  'maggio': 5, 'mag': 5,
  'giugno': 6, 'giu': 6,
  'luglio': 7, 'lug': 7,
  'agosto': 8, 'ago': 8,
  'settembre': 9, 'set': 9, 'sett': 9,
  'ottobre': 10, 'ott': 10,
  'novembre': 11, 'nov': 11,
  'dicembre': 12, 'dic': 12
};

const MONTHS_EN: Record<string, number> = {
  'january': 1, 'jan': 1,
  'february': 2, 'feb': 2,
  'march': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'may': 5,
  'june': 6, 'jun': 6,
  'july': 7, 'jul': 7,
  'august': 8, 'aug': 8,
  'september': 9, 'sep': 9, 'sept': 9,
  'october': 10, 'oct': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12
};

/**
 * Normalize text by removing accents and converting to lowercase
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

export const monthExtractor: DataExtractor<number> = {
  /**
   * Extract month from text (numeric or textual)
   * Returns numeric value 1-12
   */
  extract(text) {
    const raw = String(text || '').trim();
    
    if (!raw) {
      console.log('[NLP][month][extract] Empty input');
      return { confidence: 0, reasons: ['empty-input'] };
    }

    const norm = normalizeText(raw);
    
    // Try numeric first (1-12 or 01-12)
    const numMatch = norm.match(/^(0?[1-9]|1[0-2])$/);
    if (numMatch) {
      const monthNum = parseInt(numMatch[1], 10);
      console.log('[NLP][month][extract] Extracted numeric month', { raw, value: monthNum });
      return { value: monthNum, confidence: 0.95 };
    }

    // Try Italian month names
    if (MONTHS_IT[norm]) {
      const monthNum = MONTHS_IT[norm];
      console.log('[NLP][month][extract] Extracted IT month', { raw, value: monthNum });
      return { value: monthNum, confidence: 0.9 };
    }

    // Try English month names
    if (MONTHS_EN[norm]) {
      const monthNum = MONTHS_EN[norm];
      console.log('[NLP][month][extract] Extracted EN month', { raw, value: monthNum });
      return { value: monthNum, confidence: 0.9 };
    }

    // Partial match for Italian
    for (const [key, value] of Object.entries(MONTHS_IT)) {
      if (key.startsWith(norm) || norm.startsWith(key)) {
        console.log('[NLP][month][extract] Partial match IT', { raw, matched: key, value });
        return { value, confidence: 0.7 };
      }
    }

    // Partial match for English
    for (const [key, value] of Object.entries(MONTHS_EN)) {
      if (key.startsWith(norm) || norm.startsWith(key)) {
        console.log('[NLP][month][extract] Partial match EN', { raw, matched: key, value });
        return { value, confidence: 0.7 };
      }
    }

    console.log('[NLP][month][extract] No match found', { raw });
    return { confidence: 0, reasons: ['no-match'] };
  },

  /**
   * Validate month value (must be 1-12)
   */
  validate(v) {
    const num = typeof v === 'number' ? v : parseInt(String(v), 10);
    
    if (isNaN(num)) {
      console.log('[NLP][month][validate] Not a number', { input: v });
      return { ok: false, errors: ['not-a-number'] };
    }

    if (num < 1 || num > 12) {
      console.log('[NLP][month][validate] Out of range', { input: v, value: num });
      return { ok: false, errors: ['out-of-range'] };
    }

    console.log('[NLP][month][validate] Valid', { input: v, value: num });
    return { ok: true };
  },

  /**
   * Format month as zero-padded string (01-12)
   */
  format(v) {
    const num = typeof v === 'number' ? v : parseInt(String(v), 10);
    
    if (isNaN(num) || num < 1 || num > 12) {
      console.log('[NLP][month][format] Invalid value', { input: v });
      return String(v);
    }

    const formatted = num.toString().padStart(2, '0');
    console.log('[NLP][month][format]', { input: v, output: formatted });
    return formatted;
  }
};

