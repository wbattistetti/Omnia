/**
 * Human-friendly formatter for AI call costs.
 *
 * Regola (concordata con il prodotto, 2026-05-13):
 *   - importi < 10 centesimi (cio\u00e8 valore < 0,10 unit\u00e0)  => stringa in **centesimi** con
 *     suffisso `cent.` (es. `0,87 cent.`, `7,40 cent.`). Sotto questa soglia la notazione
 *     decimale `\u20ac0,0087` \u00e8 illeggibile per il designer.
 *   - importi >= 10 centesimi                               => notazione decimale standard
 *     `Intl.NumberFormat` (es. `0,15 \u20ac`, `1,25 \u20ac`, `$0.15`, `$1.25`).
 *
 * Esempi (locale `it-IT` per EUR, `en-US` per USD):
 *   formatCost(1.50,   'EUR') -> '1,50 \u20ac'
 *   formatCost(0.15,   'EUR') -> '0,15 \u20ac'
 *   formatCost(0.10,   'EUR') -> '0,10 \u20ac'   (esattamente 10 cent: si usa la decimale)
 *   formatCost(0.087,  'EUR') -> '8,70 cent.'
 *   formatCost(0.0074, 'EUR') -> '0,74 cent.'
 *   formatCost(1.50,   'USD') -> '$1.50'
 *   formatCost(0.0074, 'USD') -> '0.74 cent.'
 *
 * NB: la stessa regola guida `LastAiCostBadge` e i totali del report ad albero
 * (`AiCallLogDialog`). Mantenere la formattazione in un unico punto evita drift visivo.
 */

export type CostCurrency = 'EUR' | 'USD';

/** Soglia di switch tra notazione "centesimi" e notazione decimale (= 10 cent). */
const CENTS_THRESHOLD = 0.1;

const DECIMAL_FORMATTERS: Record<CostCurrency, Intl.NumberFormat> = {
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

/**
 * Formatta un valore < 10 cent come "X,YY cent." (sempre 2 decimali per omogeneit\u00e0). I costi
 * IA si misurano facilmente in millesimi di centesimo, quindi 2 decimali sono il giusto
 * compromesso tra precisione e leggibilit\u00e0.
 */
function formatCents(cents: number, currency: CostCurrency): string {
  return `${cents.toLocaleString(CENTS_LOCALE[currency], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} cent.`;
}

export function formatCost(value: number, currency: CostCurrency): string {
  if (!Number.isFinite(value) || value < 0) return '-';
  if (value >= CENTS_THRESHOLD) {
    return DECIMAL_FORMATTERS[currency].format(value);
  }
  return formatCents(value * 100, currency);
}

