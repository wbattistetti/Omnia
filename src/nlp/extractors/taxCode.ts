// Tax Code / Fiscal Code / SSN extractor
// Supports: Italian Codice Fiscale, US SSN, and generic formats

import { DataExtractor, ExtractionResult } from '../types';
import { normalizeText } from './base';

export type TaxCodeValue = string;

/**
 * Validates Italian Codice Fiscale format (16 chars: RSSMRA80A01H501Z)
 */
function isValidItalianTaxCode(code: string): boolean {
  const regex = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;
  return regex.test(code);
}

/**
 * Validates US SSN format (9 digits with optional separators: 123-45-6789 or 123456789)
 */
function isValidUSSSN(code: string): boolean {
  const cleaned = code.replace(/[-\s]/g, '');
  return /^\d{9}$/.test(cleaned);
}

/**
 * Extracts and validates tax/fiscal codes from text
 */
export const taxCodeExtractor: DataExtractor<TaxCodeValue> = {
  extract(text: string): ExtractionResult<TaxCodeValue> {
    const raw = String(text || '').trim();
    
    if (!raw) {
      return {
        confidence: 0,
        reasons: ['empty-input']
      };
    }

    const normalized = normalizeText(raw).toUpperCase();

    // Try Italian Codice Fiscale (16 alphanumeric)
    const italianMatch = normalized.match(/[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/);
    if (italianMatch && isValidItalianTaxCode(italianMatch[0])) {
      return {
        value: italianMatch[0],
        confidence: 0.95,
        metadata: { format: 'italian-cf', length: 16 }
      };
    }

    // Try US SSN (9 digits with optional dashes)
    const ssnMatch = raw.match(/\d{3}[-\s]?\d{2}[-\s]?\d{4}/);
    if (ssnMatch && isValidUSSSN(ssnMatch[0])) {
      const cleaned = ssnMatch[0].replace(/[-\s]/g, '');
      return {
        value: cleaned,
        confidence: 0.90,
        metadata: { format: 'us-ssn', length: 9 }
      };
    }

    // Generic alphanumeric code (fallback for other countries)
    const genericMatch = normalized.match(/[A-Z0-9]{8,20}/);
    if (genericMatch) {
      return {
        value: genericMatch[0],
        confidence: 0.70,
        reasons: ['generic-format'],
        metadata: { format: 'generic', length: genericMatch[0].length }
      };
    }

    return {
      confidence: 0,
      reasons: ['no-tax-code-pattern']
    };
  },

  validate(value: TaxCodeValue): boolean {
    if (!value || typeof value !== 'string') return false;
    
    const cleaned = value.trim().toUpperCase();
    
    // Valid if Italian CF or US SSN or generic alphanumeric 8-20 chars
    return (
      isValidItalianTaxCode(cleaned) ||
      isValidUSSSN(cleaned) ||
      (/^[A-Z0-9]{8,20}$/.test(cleaned))
    );
  },

  format(value: TaxCodeValue): string {
    if (!value) return '—';
    
    const cleaned = value.trim().toUpperCase();
    
    // Format US SSN with dashes (123-45-6789)
    if (/^\d{9}$/.test(cleaned)) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    }
    
    // Return as-is for other formats
    return cleaned;
  }
};

