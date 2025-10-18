// Postal Code / ZIP Code extractor
// Supports various international formats

import { DataExtractor, ExtractionResult } from '../types';
import { normalizeText } from './base';

export type PostalCodeValue = string;

/**
 * Validates postal code formats for different countries
 */
function validatePostalCode(code: string): { valid: boolean; country?: string } {
  const patterns: Record<string, RegExp> = {
    'IT': /^\d{5}$/,              // Italy: 20121
    'US': /^\d{5}(-\d{4})?$/,     // USA: 12345 or 12345-6789
    'GB': /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i, // UK: SW1A 1AA
    'FR': /^\d{5}$/,              // France: 75001
    'DE': /^\d{5}$/,              // Germany: 10115
    'ES': /^\d{5}$/,              // Spain: 28001
    'CA': /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i, // Canada: K1A 0B1
    'NL': /^\d{4}\s?[A-Z]{2}$/,   // Netherlands: 1012 AB
    'CH': /^\d{4}$/,              // Switzerland: 8001
    'AT': /^\d{4}$/,              // Austria: 1010
    'BE': /^\d{4}$/,              // Belgium: 1000
    'PT': /^\d{4}-\d{3}$/,        // Portugal: 1000-001
  };

  for (const [country, pattern] of Object.entries(patterns)) {
    if (pattern.test(code)) {
      return { valid: true, country };
    }
  }

  return { valid: false };
}

/**
 * Extracts and validates postal codes from text
 */
export const postalCodeExtractor: DataExtractor<PostalCodeValue> = {
  extract(text: string): ExtractionResult<PostalCodeValue> {
    const raw = String(text || '').trim();
    
    if (!raw) {
      return {
        confidence: 0,
        reasons: ['empty-input']
      };
    }

    const normalized = normalizeText(raw).toUpperCase();

    // Try common patterns
    const patterns = [
      /\b\d{5}(-\d{4})?\b/,                    // US/IT/FR/DE/ES (5 or 5+4 digits)
      /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i, // UK
      /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i,         // Canada
      /\b\d{4}\s?[A-Z]{2}\b/,                  // Netherlands
      /\b\d{4}-\d{3}\b/,                       // Portugal
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (match) {
        const code = match[0].toUpperCase();
        const validation = validatePostalCode(code);
        
        if (validation.valid) {
          return {
            value: code,
            confidence: 0.90,
            metadata: {
              country: validation.country,
              format: 'validated'
            }
          };
        }
      }
    }

    // Generic fallback: 4-7 alphanumeric chars (could be a postal code)
    const genericMatch = normalized.match(/\b[A-Z0-9]{4,7}\b/);
    if (genericMatch) {
      return {
        value: genericMatch[0],
        confidence: 0.60,
        reasons: ['generic-pattern'],
        metadata: {
          format: 'generic',
          length: genericMatch[0].length
        }
      };
    }

    return {
      confidence: 0,
      reasons: ['no-postal-code-pattern']
    };
  },

  validate(value: PostalCodeValue): boolean {
    if (!value || typeof value !== 'string') return false;
    
    const validation = validatePostalCode(value.trim());
    return validation.valid || /^[A-Z0-9]{4,10}$/.test(value.trim().toUpperCase());
  },

  format(value: PostalCodeValue): string {
    if (!value) return '—';
    return value.trim().toUpperCase();
  }
};

