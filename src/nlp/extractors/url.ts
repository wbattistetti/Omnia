// URL extractor
// Supports web URLs with or without protocol

import { DataExtractor, ExtractionResult } from '../types';
import { normalizeText } from './base';

export type URLValue = string;

/**
 * Validates URL format
 */
function isValidURL(url: string): boolean {
  try {
    // Try to parse with URL constructor
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.includes('.');
  } catch {
    return false;
  }
}

/**
 * Extracts and validates URLs from text
 */
export const urlExtractor: DataExtractor<URLValue> = {
  extract(text: string): ExtractionResult<URLValue> {
    const raw = String(text || '').trim();
    
    if (!raw) {
      return {
        confidence: 0,
        reasons: ['empty-input']
      };
    }

    const normalized = normalizeText(raw);

    // Pattern 1: Full URL with protocol (https://example.com, http://site.it/path)
    const fullUrlPattern = /(https?:\/\/[^\s]+)/i;
    const fullUrlMatch = normalized.match(fullUrlPattern);
    
    if (fullUrlMatch) {
      const url = fullUrlMatch[1];
      if (isValidURL(url)) {
        return {
          value: url,
          confidence: 0.95,
          metadata: {
            format: 'full',
            hasProtocol: true
          }
        };
      }
    }

    // Pattern 2: URL without protocol (www.example.com, example.com)
    const domainPattern = /(?:www\.)?([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}(?:\/[^\s]*)?/i;
    const domainMatch = normalized.match(domainPattern);
    
    if (domainMatch) {
      const url = domainMatch[0];
      if (isValidURL(url)) {
        return {
          value: url.startsWith('www.') ? `https://${url}` : `https://${url}`,
          confidence: 0.85,
          metadata: {
            format: 'no-protocol',
            hasProtocol: false
          }
        };
      }
    }

    // Pattern 3: Email-like domain (user@example.com - but keep the domain part only)
    const emailDomainPattern = /@([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}/i;
    const emailDomainMatch = normalized.match(emailDomainPattern);
    
    if (emailDomainMatch) {
      const domain = emailDomainMatch[0].slice(1); // Remove @
      return {
        value: `https://${domain}`,
        confidence: 0.65,
        reasons: ['extracted-from-email'],
        metadata: {
          format: 'email-domain'
        }
      };
    }

    return {
      confidence: 0,
      reasons: ['no-url-pattern']
    };
  },

  validate(value: URLValue): boolean {
    if (!value || typeof value !== 'string') return false;
    return isValidURL(value);
  },

  format(value: URLValue): string {
    if (!value) return '—';
    
    // Ensure URL has protocol
    if (!value.startsWith('http://') && !value.startsWith('https://')) {
      return `https://${value}`;
    }
    
    return value;
  }
};

