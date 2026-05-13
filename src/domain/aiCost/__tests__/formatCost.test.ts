/**
 * Test della regola "10 centesimi" di {@link formatCost} (vedi modulo per il rationale):
 *   - sotto 10 cent (= 0.10 unit\u00e0)  => "X,YY cent." (sempre 2 decimali)
 *   - >= 10 cent                     => notazione decimale standard (`Intl.NumberFormat`)
 */

import { describe, it, expect } from 'vitest';
import { formatCost } from '../formatCost';

describe('formatCost', () => {
  describe('decimal notation (>= 10 cent)', () => {
    it('renders EUR with the locale separator and the \u20ac symbol', () => {
      expect(formatCost(1.5, 'EUR')).toMatch(/1[.,]50/);
      expect(formatCost(1.5, 'EUR')).toContain('\u20ac');
    });

    it('renders USD with $ prefix and dot as decimal separator', () => {
      expect(formatCost(2.34, 'USD')).toBe('$2.34');
    });

    it('uses decimal also for amounts in [0.10, 1) — the previous "cents" boundary', () => {
      expect(formatCost(0.15, 'EUR')).toMatch(/0[.,]15.*\u20ac|\u20ac.*0[.,]15/);
      expect(formatCost(0.7, 'USD')).toBe('$0.70');
    });

    it('uses decimal exactly at the 10 cent boundary (0.10 is decimal, not cents)', () => {
      expect(formatCost(0.1, 'EUR')).toMatch(/0[.,]10.*\u20ac|\u20ac.*0[.,]10/);
      expect(formatCost(0.1, 'USD')).toBe('$0.10');
    });
  });

  describe('cents notation (< 10 cent)', () => {
    it('renders strictly under 10 cent in cents (always 2 decimals)', () => {
      expect(formatCost(0.087, 'EUR')).toBe('8,70 cent.');
      expect(formatCost(0.087, 'USD')).toBe('8.70 cent.');
    });

    it('keeps the same 2-decimal format for micro-charges below 1 cent', () => {
      expect(formatCost(0.0074, 'EUR')).toBe('0,74 cent.');
      expect(formatCost(0.0074, 'USD')).toBe('0.74 cent.');
    });

    it('handles exactly zero as "0,00 cent." (not the placeholder)', () => {
      expect(formatCost(0, 'EUR')).toBe('0,00 cent.');
      expect(formatCost(0, 'USD')).toBe('0.00 cent.');
    });
  });

  describe('guards', () => {
    it('returns the dash placeholder for non-finite or negative inputs', () => {
      expect(formatCost(NaN, 'EUR')).toBe('-');
      expect(formatCost(-1, 'USD')).toBe('-');
    });
  });
});
