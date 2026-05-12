// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { formatCost } from '../formatCost';

describe('formatCost', () => {
  it('renders standard currency notation when the cost reaches one full unit', () => {
    expect(formatCost(1.5, 'EUR')).toMatch(/1[.,]50/);
    expect(formatCost(1.5, 'EUR')).toContain('EUR' === 'EUR' ? '\u20ac' : 'EUR');
    expect(formatCost(2.34, 'USD')).toBe('$2.34');
  });

  it('switches to cents (suffix "cent.") when the cost is below one unit', () => {
    expect(formatCost(0.7, 'EUR')).toBe('70 cent.');
    expect(formatCost(0.7, 'USD')).toBe('70 cent.');
  });

  it('keeps one decimal between 1 and 10 cents to retain precision', () => {
    expect(formatCost(0.07, 'EUR')).toBe('7,0 cent.');
    expect(formatCost(0.07, 'USD')).toBe('7.0 cent.');
  });

  it('keeps two decimals below 1 cent so micro-charges are still readable', () => {
    expect(formatCost(0.0074, 'EUR')).toBe('0,74 cent.');
    expect(formatCost(0.0074, 'USD')).toBe('0.74 cent.');
  });

  it('rounds to whole cents from 10 cents upwards (no decimal noise)', () => {
    expect(formatCost(0.123, 'EUR')).toBe('12 cent.');
    expect(formatCost(0.999, 'USD')).toBe('100 cent.');
  });

  it('returns a placeholder for invalid or negative values (no NaN leaking to UI)', () => {
    expect(formatCost(NaN, 'EUR')).toBe('-');
    expect(formatCost(-1, 'USD')).toBe('-');
  });

  it('handles exactly zero by emitting "0,00 cent." (not the placeholder)', () => {
    expect(formatCost(0, 'EUR')).toBe('0,00 cent.');
    expect(formatCost(0, 'USD')).toBe('0.00 cent.');
  });
});
