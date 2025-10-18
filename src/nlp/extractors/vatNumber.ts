// VAT Number (Partita IVA) extractor
// Supports Italian and EU VAT formats

import { DataExtractor, ExtractionResult } from '../types';
import { normalizeText } from './base';

export type VATNumberValue = string;

/**
 * Validates Italian VAT format (IT + 11 digits)
 */
function isValidItalianVAT(vat: string): boolean {
  const cleaned = vat.replace(/^IT/i, '').replace(/\s/g, '');
  
  if (!/^\d{11}$/.test(cleaned)) return false;
  
  // Checksum validation for Italian VAT
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = parseInt(cleaned[i]);
    if (i % 2 === 0) {
      // Even positions (0, 2, 4, ...)
      sum += digit;
    } else {
      // Odd positions (1, 3, 5, ...)
      digit *= 2;
      sum += digit > 9 ? digit - 9 : digit;
    }
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleaned[10]);
}

/**
 * Validates EU VAT format (country code + digits)
 */
function isValidEUVAT(vat: string): boolean {
  const pattern = /^[A-Z]{2}[A-Z0-9]{2,12}$/;
  return pattern.test(vat);
}

/**
 * Extracts and validates VAT numbers from text
 */
export const vatNumberExtractor: DataExtractor<VATNumberValue> = {
  extract(text: string): ExtractionResult<VATNumberValue> {
    const raw = String(text || '').trim();
    
    if (!raw) {
      return {
        confidence: 0,
        reasons: ['empty-input']
      };
    }

    const normalized = normalizeText(raw).toUpperCase().replace(/[\s-]/g, '');

    // Try Italian VAT (IT + 11 digits or just 11 digits)
    const italianMatch = normalized.match(/(?:IT)?(\d{11})/);
    if (italianMatch) {
      const fullVat = `IT${italianMatch[1]}`;
      if (isValidItalianVAT(fullVat)) {
        return {
          value: fullVat,
          confidence: 0.95,
          metadata: { 
            country: 'IT',
            format: 'italian',
            length: 13
          }
        };
      }
    }

    // Try EU VAT pattern (2 letters + 2-12 alphanumeric)
    const euMatch = normalized.match(/[A-Z]{2}[A-Z0-9]{2,12}/);
    if (euMatch && isValidEUVAT(euMatch[0])) {
      return {
        value: euMatch[0],
        confidence: 0.85,
        metadata: { 
          country: euMatch[0].slice(0, 2),
          format: 'eu',
          length: euMatch[0].length
        }
      };
    }

    // Generic number that could be a VAT (8-13 digits)
    const genericMatch = normalized.match(/\d{8,13}/);
    if (genericMatch) {
      return {
        value: genericMatch[0],
        confidence: 0.60,
        reasons: ['no-country-code'],
        metadata: { 
          format: 'generic-digits',
          length: genericMatch[0].length
        }
      };
    }

    return {
      confidence: 0,
      reasons: ['no-vat-pattern']
    };
  },

  validate(value: VATNumberValue): boolean {
    if (!value || typeof value !== 'string') return false;
    
    const cleaned = value.trim().toUpperCase().replace(/[\s-]/g, '');
    
    return (
      isValidItalianVAT(cleaned) ||
      isValidEUVAT(cleaned) ||
      /^\d{8,13}$/.test(cleaned)
    );
  },

  format(value: VATNumberValue): string {
    if (!value) return '—';
    
    const cleaned = value.trim().toUpperCase().replace(/[\s-]/g, '');
    
    // Format Italian VAT (IT 12345 67890 1)
    if (cleaned.startsWith('IT') && cleaned.length === 13) {
      const digits = cleaned.slice(2);
      return `IT ${digits.slice(0, 5)} ${digits.slice(5, 10)} ${digits.slice(10)}`;
    }
    
    // Return as-is for other formats
    return cleaned;
  }
};

