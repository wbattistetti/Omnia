// POD/PDR Code extractor for Italian utility meters
// POD (Punto di Prelievo) - Electricity: IT001E12345678
// PDR (Punto di Riconsegna) - Gas: 14-digit number

import { DataExtractor, ExtractionResult } from '../types';
import { normalizeText } from './base';

export type PodPdrCodeValue = {
  code: string;
  type: 'pod' | 'pdr' | 'unknown';
};

/**
 * Validates POD format (IT + 3 digits + E + 8 digits)
 */
function isValidPOD(code: string): boolean {
  return /^IT\d{3}E\d{8}$/.test(code);
}

/**
 * Validates PDR format (14 digits)
 */
function isValidPDR(code: string): boolean {
  return /^\d{14}$/.test(code);
}

/**
 * Extracts and validates POD/PDR codes from text
 */
export const podPdrCodeExtractor: DataExtractor<PodPdrCodeValue> = {
  extract(text: string): ExtractionResult<PodPdrCodeValue> {
    const raw = String(text || '').trim();
    
    if (!raw) {
      return {
        confidence: 0,
        reasons: ['empty-input']
      };
    }

    const normalized = normalizeText(raw).toUpperCase().replace(/[\s-]/g, '');

    // Try POD (electricity) pattern
    const podMatch = normalized.match(/IT\d{3}E\d{8}/);
    if (podMatch && isValidPOD(podMatch[0])) {
      return {
        value: {
          code: podMatch[0],
          type: 'pod'
        },
        confidence: 0.95,
        metadata: { 
          utility: 'electricity',
          format: 'IT###E########',
          length: 14
        }
      };
    }

    // Try PDR (gas) pattern - 14 consecutive digits
    const pdrMatch = normalized.match(/\d{14}/);
    if (pdrMatch && isValidPDR(pdrMatch[0])) {
      return {
        value: {
          code: pdrMatch[0],
          type: 'pdr'
        },
        confidence: 0.90,
        metadata: { 
          utility: 'gas',
          format: '14-digits',
          length: 14
        }
      };
    }

    // Generic utility code (10-15 alphanumeric chars)
    const genericMatch = normalized.match(/[A-Z0-9]{10,15}/);
    if (genericMatch) {
      return {
        value: {
          code: genericMatch[0],
          type: 'unknown'
        },
        confidence: 0.65,
        reasons: ['generic-utility-code'],
        metadata: { 
          utility: 'unknown',
          format: 'generic',
          length: genericMatch[0].length
        }
      };
    }

    return {
      confidence: 0,
      reasons: ['no-pod-pdr-pattern']
    };
  },

  validate(value: PodPdrCodeValue): boolean {
    if (!value || typeof value !== 'object' || !value.code) return false;
    
    const code = value.code.trim().toUpperCase().replace(/[\s-]/g, '');
    
    return (
      isValidPOD(code) ||
      isValidPDR(code) ||
      (/^[A-Z0-9]{10,15}$/.test(code))
    );
  },

  format(value: PodPdrCodeValue): string {
    if (!value || !value.code) return '—';
    
    const code = value.code.trim().toUpperCase();
    
    // Format POD with spaces (IT001 E 12345678)
    if (value.type === 'pod') {
      return `${code.slice(0, 5)} ${code.slice(5, 6)} ${code.slice(6)}`;
    }
    
    // Format PDR with spaces every 4 digits (1234 5678 9012 34)
    if (value.type === 'pdr') {
      return code.match(/.{1,4}/g)?.join(' ') || code;
    }
    
    return code;
  }
};

