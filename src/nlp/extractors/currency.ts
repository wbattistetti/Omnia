// Currency/Amount extractor
// Supports various currency formats (€, $, £, etc.)

import { DataExtractor, ExtractionResult } from '../types';
import { normalizeText } from './base';

export type CurrencyValue = {
  amount: number;
  currency?: string;
};

/**
 * Currency symbols mapping
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  '$': 'USD',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  'CHF': 'CHF',
  'EUR': 'EUR',
  'USD': 'USD',
  'GBP': 'GBP'
};

/**
 * Extracts and validates currency amounts from text
 */
export const currencyExtractor: DataExtractor<CurrencyValue> = {
  extract(text: string): ExtractionResult<CurrencyValue> {
    const raw = String(text || '').trim();
    
    if (!raw) {
      return {
        confidence: 0,
        reasons: ['empty-input']
      };
    }

    const normalized = normalizeText(raw);

    // Pattern 1: Symbol + number (€ 150,50 or $100.00)
    const symbolFirstPattern = /([€$£¥₹])\s*([\d.,]+)/;
    const symbolFirstMatch = raw.match(symbolFirstPattern);
    
    if (symbolFirstMatch) {
      const symbol = symbolFirstMatch[1];
      const amountStr = symbolFirstMatch[2].replace(/,/g, '.');
      const amount = parseFloat(amountStr);
      
      if (!isNaN(amount)) {
        return {
          value: {
            amount,
            currency: CURRENCY_SYMBOLS[symbol]
          },
          confidence: 0.95,
          metadata: {
            format: 'symbol-first',
            originalString: symbolFirstMatch[0]
          }
        };
      }
    }

    // Pattern 2: Number + symbol (150,50€ or 100$)
    const symbolLastPattern = /([\d.,]+)\s*([€$£¥₹])/;
    const symbolLastMatch = raw.match(symbolLastPattern);
    
    if (symbolLastMatch) {
      const amountStr = symbolLastMatch[1].replace(/,/g, '.');
      const symbol = symbolLastMatch[2];
      const amount = parseFloat(amountStr);
      
      if (!isNaN(amount)) {
        return {
          value: {
            amount,
            currency: CURRENCY_SYMBOLS[symbol]
          },
          confidence: 0.95,
          metadata: {
            format: 'symbol-last',
            originalString: symbolLastMatch[0]
          }
        };
      }
    }

    // Pattern 3: Number + currency code (150 EUR, 100 USD)
    const codePattern = /([\d.,]+)\s*(EUR|USD|GBP|CHF|JPY|INR)/i;
    const codeMatch = raw.match(codePattern);
    
    if (codeMatch) {
      const amountStr = codeMatch[1].replace(/,/g, '.');
      const currencyCode = codeMatch[2].toUpperCase();
      const amount = parseFloat(amountStr);
      
      if (!isNaN(amount)) {
        return {
          value: {
            amount,
            currency: currencyCode
          },
          confidence: 0.90,
          metadata: {
            format: 'code-suffix',
            originalString: codeMatch[0]
          }
        };
      }
    }

    // Pattern 4: Just a number (fallback, no currency)
    const numberMatch = normalized.match(/[\d.,]+/);
    if (numberMatch) {
      const amountStr = numberMatch[0].replace(/,/g, '.');
      const amount = parseFloat(amountStr);
      
      if (!isNaN(amount)) {
        return {
          value: {
            amount,
            currency: undefined
          },
          confidence: 0.70,
          reasons: ['no-currency-symbol'],
          metadata: {
            format: 'number-only',
            originalString: numberMatch[0]
          }
        };
      }
    }

    return {
      confidence: 0,
      reasons: ['no-amount-pattern']
    };
  },

  validate(value: CurrencyValue): boolean {
    if (!value || typeof value !== 'object') return false;
    if (typeof value.amount !== 'number') return false;
    if (isNaN(value.amount) || value.amount < 0) return false;
    
    return true;
  },

  format(value: CurrencyValue): string {
    if (!value || typeof value.amount !== 'number') return '—';
    
    const formatted = value.amount.toFixed(2);
    
    if (value.currency) {
      // Find symbol for currency code
      const symbol = Object.entries(CURRENCY_SYMBOLS)
        .find(([sym, code]) => code === value.currency)?.[0];
      
      if (symbol && symbol.length === 1) {
        // Use symbol (€ 150.50)
        return `${symbol} ${formatted}`;
      }
      
      // Use code (150.50 USD)
      return `${formatted} ${value.currency}`;
    }
    
    return formatted;
  }
};

