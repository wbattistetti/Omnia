// Account Number / Contract Number extractor
// Generic alphanumeric account/contract identifiers

import { DataExtractor, ExtractionResult } from '../types';
import { normalizeText } from './base';

export type AccountNumberValue = string;

/**
 * Extracts and validates account/contract numbers from text
 */
export const accountNumberExtractor: DataExtractor<AccountNumberValue> = {
  extract(text: string): ExtractionResult<AccountNumberValue> {
    const raw = String(text || '').trim();
    
    if (!raw) {
      return {
        confidence: 0,
        reasons: ['empty-input']
      };
    }

    const normalized = normalizeText(raw).toUpperCase();

    // Pattern 1: Prefixed account (ACC-2024-001234, CTR123456)
    const prefixedPattern = /(?:ACC|CTR|CNT|ACCT|CONTRACT|ACCOUNT)[-\s]?[\dA-Z]{4,20}/;
    const prefixedMatch = normalized.match(prefixedPattern);
    
    if (prefixedMatch) {
      return {
        value: prefixedMatch[0].replace(/\s/g, ''),
        confidence: 0.90,
        metadata: {
          format: 'prefixed',
          hasPrefix: true
        }
      };
    }

    // Pattern 2: Pure numeric (8-15 digits)
    const numericPattern = /\d{8,15}/;
    const numericMatch = normalized.match(numericPattern);
    
    if (numericMatch) {
      return {
        value: numericMatch[0],
        confidence: 0.75,
        metadata: {
          format: 'numeric',
          length: numericMatch[0].length
        }
      };
    }

    // Pattern 3: Alphanumeric (6-20 chars with at least one digit)
    const alphanumericPattern = /[A-Z0-9]{6,20}/;
    const alphanumericMatch = normalized.match(alphanumericPattern);
    
    if (alphanumericMatch && /\d/.test(alphanumericMatch[0])) {
      return {
        value: alphanumericMatch[0],
        confidence: 0.65,
        reasons: ['generic-alphanumeric'],
        metadata: {
          format: 'alphanumeric',
          length: alphanumericMatch[0].length
        }
      };
    }

    return {
      confidence: 0,
      reasons: ['no-account-pattern']
    };
  },

  validate(value: AccountNumberValue): boolean {
    if (!value || typeof value !== 'string') return false;
    
    const cleaned = value.trim().toUpperCase();
    
    // Valid if 6-20 alphanumeric chars with at least one digit
    return /^[A-Z0-9]{6,20}$/.test(cleaned) && /\d/.test(cleaned);
  },

  format(value: AccountNumberValue): string {
    if (!value) return '—';
    return value.trim().toUpperCase();
  }
};

