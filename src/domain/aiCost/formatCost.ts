/**
 * Human-friendly formatter for AI call costs.
 *
 * Rule: when a cost is below one full unit (1 EUR / 1 USD) we render it in cents — using the
 * suffix `cent.` — to avoid noisy strings like `$0.0074`. Above 1 unit we render the standard
 * currency notation with two decimals.
 *
 * Examples:
 *   formatCost(1.50, 'EUR') -> 'EUR1,50'    (locale: it-IT)
 *   formatCost(0.70, 'EUR') -> '70 cent.'
 *   formatCost(0.07, 'EUR') -> '7,0 cent.'
 *   formatCost(0.0074, 'EUR') -> '0,74 cent.'
 *   formatCost(1.50, 'USD') -> '$1.50'      (locale: en-US)
 */

export type CostCurrency = 'EUR' | 'USD';

const FULL_UNIT_FORMATTERS: Record<CostCurrency, Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  USD: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

const CENTS_LOCALE: Record<CostCurrency, string> = {
  EUR: 'it-IT',
  USD: 'en-US',
};

function formatCents(cents: number, currency: CostCurrency): string {
  if (cents >= 10) {
    return `${cents.toLocaleString(CENTS_LOCALE[currency], { maximumFractionDigits: 0 })} cent.`;
  }
  if (cents >= 1) {
    return `${cents.toLocaleString(CENTS_LOCALE[currency], {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} cent.`;
  }
  return `${cents.toLocaleString(CENTS_LOCALE[currency], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} cent.`;
}

export function formatCost(value: number, currency: CostCurrency): string {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value >= 1) {
    return FULL_UNIT_FORMATTERS[currency].format(value);
  }
  return formatCents(value * 100, currency);
}
