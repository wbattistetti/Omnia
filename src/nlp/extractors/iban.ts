// IBAN (International Bank Account Number) extractor
// Supports ISO 13616 compliant IBANs

import { DataExtractor, ExtractionResult } from '../types';
import { normalizeText } from './base';

export type IBANValue = string;

/**
 * Validates IBAN format and checksum (basic validation)
 */
function isValidIBAN(iban: string): boolean {
  // Remove spaces and convert to uppercase
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  
  // Check format: 2 letters + 2 digits + up to 30 alphanumeric
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned)) {
    return false;
  }
  
  // Length validation per country (sample of common countries)
  const countryLengths: Record<string, number> = {
    'IT': 27, 'GB': 22, 'FR': 27, 'DE': 22, 'ES': 24,
    'AT': 20, 'BE': 16, 'CH': 21, 'NL': 18, 'PT': 25
  };
  
  const country = cleaned.slice(0, 2);
  const expectedLength = countryLengths[country];
  
  if (expectedLength && cleaned.length !== expectedLength) {
    return false;
  }
  
  // IBAN checksum validation (mod-97 algorithm)
  try {
    // Move first 4 chars to end
    const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
    
    // Replace letters with numbers (A=10, B=11, ..., Z=35)
    let numericString = '';
    for (const char of rearranged) {
      if (/[A-Z]/.test(char)) {
        numericString += (char.charCodeAt(0) - 55).toString();
      } else {
        numericString += char;
      }
    }
    
    // Calculate mod 97
    let remainder = 0;
    for (let i = 0; i < numericString.length; i++) {
      remainder = (remainder * 10 + parseInt(numericString[i])) % 97;
    }
    
    return remainder === 1;
  } catch {
    return false;
  }
}

/**
 * Extracts and validates IBAN from text
 */
export const ibanExtractor: DataExtractor<IBANValue> = {
  extract(text: string): ExtractionResult<IBANValue> {
    const raw = String(text || '').trim();
    
    if (!raw) {
      return {
        confidence: 0,
        reasons: ['empty-input']
      };
    }

    const normalized = normalizeText(raw).toUpperCase();

    // Match IBAN pattern (with or without spaces)
    // Example: IT60X0542811101000000123456 or IT60 X054 2811 1010 0000 0012 3456
    const ibanPattern = /[A-Z]{2}\s?\d{2}\s?[A-Z0-9\s]{12,30}/g;
    const matches = normalized.match(ibanPattern);

    if (matches) {
      for (const match of matches) {
        const cleaned = match.replace(/\s/g, '');
        
        if (isValidIBAN(cleaned)) {
          return {
            value: cleaned,
            confidence: 0.95,
            metadata: { 
              country: cleaned.slice(0, 2),
              checkDigits: cleaned.slice(2, 4),
              length: cleaned.length
            }
          };
        }
      }
      
      // Found pattern but checksum failed
      const cleaned = matches[0].replace(/\s/g, '');
      return {
        value: cleaned,
        confidence: 0.60,
        reasons: ['checksum-failed'],
        metadata: { 
          country: cleaned.slice(0, 2),
          length: cleaned.length
        }
      };
    }

    return {
      confidence: 0,
      reasons: ['no-iban-pattern']
    };
  },

  validate(value: IBANValue): boolean {
    if (!value || typeof value !== 'string') return false;
    return isValidIBAN(value);
  },

  format(value: IBANValue): string {
    if (!value) return '—';
    
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    
    // Format with spaces every 4 chars (IT60 X054 2811 1010...)
    return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
  }
};

