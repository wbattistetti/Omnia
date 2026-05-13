/**
 * Unit test del dominio "Cost comparator". Verifichiamo:
 *  - ordinamento per costo totale DESC con tie-break alfabetico
 *  - classificazione free (entrambi i prezzi a 0)
 *  - conversione USD→EUR opportunistica (null quando il cambio non c'è)
 *  - barra: 0..100% sul max della tabella; 0% per i free
 *  - filtro per provider whitelist
 *
 * Logica pura, nessuna dipendenza da React/DOM.
 */

import { describe, expect, it } from 'vitest';
import {
  buildCostComparatorRows,
  filterPricingByProviders,
  isAboveCostThresholdEur,
  isFreePricing,
  usdToEurOrNull,
  type ProviderId,
} from '../costComparator';
import type { LlmPricingEntry } from '@services/aiCallsApi';

function entry(overrides: Partial<LlmPricingEntry> = {}): LlmPricingEntry {
  const providerId: ProviderId = overrides.providerId ?? 'openai';
  const modelId = overrides.modelId ?? 'gpt-test';
  return {
    providerId,
    modelId,
    inputUsdPer1M: overrides.inputUsdPer1M ?? 1,
    outputUsdPer1M: overrides.outputUsdPer1M ?? 2,
    contextLength: overrides.contextLength ?? null,
    rawId: overrides.rawId ?? `${providerId}/${modelId}`,
  };
}

describe('isFreePricing', () => {
  it('true solo se input e output sono entrambi 0 USD/M', () => {
    expect(isFreePricing(entry({ inputUsdPer1M: 0, outputUsdPer1M: 0 }))).toBe(true);
  });
  it('false se input > 0', () => {
    expect(isFreePricing(entry({ inputUsdPer1M: 0.01, outputUsdPer1M: 0 }))).toBe(false);
  });
  it('false se output > 0', () => {
    expect(isFreePricing(entry({ inputUsdPer1M: 0, outputUsdPer1M: 0.01 }))).toBe(false);
  });
});

describe('usdToEurOrNull', () => {
  it('moltiplica per il cambio quando disponibile', () => {
    expect(usdToEurOrNull(10, 0.92)).toBeCloseTo(9.2, 6);
  });
  it('null quando il cambio è null', () => {
    expect(usdToEurOrNull(10, null)).toBeNull();
  });
  it('null quando il cambio non è finito (NaN, Infinity)', () => {
    expect(usdToEurOrNull(10, Number.NaN)).toBeNull();
    expect(usdToEurOrNull(10, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('buildCostComparatorRows', () => {
  it('lista vuota → output vuoto', () => {
    expect(buildCostComparatorRows([], 0.92)).toEqual([]);
  });

  it('ordina per costo totale EUR DESC con tie-break alfabetico ASC', () => {
    const rows = buildCostComparatorRows(
      [
        entry({ modelId: 'b-cheap', inputUsdPer1M: 1, outputUsdPer1M: 1 }),
        entry({ modelId: 'a-expensive', inputUsdPer1M: 10, outputUsdPer1M: 20 }),
        entry({ modelId: 'a-cheap', inputUsdPer1M: 1, outputUsdPer1M: 1 }),
      ],
      0.92
    );
    expect(rows.map((r) => r.modelId)).toEqual(['a-expensive', 'a-cheap', 'b-cheap']);
  });

  it('mette i free in fondo (totale 0) con tie-break alfabetico', () => {
    const rows = buildCostComparatorRows(
      [
        entry({ modelId: 'free-z', inputUsdPer1M: 0, outputUsdPer1M: 0 }),
        entry({ modelId: 'paid', inputUsdPer1M: 5, outputUsdPer1M: 5 }),
        entry({ modelId: 'free-a', inputUsdPer1M: 0, outputUsdPer1M: 0 }),
      ],
      0.92
    );
    expect(rows.map((r) => r.modelId)).toEqual(['paid', 'free-a', 'free-z']);
    expect(rows[1].isFree).toBe(true);
    expect(rows[2].isFree).toBe(true);
  });

  it('barra 100% sul costo massimo, 0% per i free, scalare per gli altri', () => {
    const rows = buildCostComparatorRows(
      [
        entry({ modelId: 'top', inputUsdPer1M: 10, outputUsdPer1M: 10 }), // tot 20
        entry({ modelId: 'mid', inputUsdPer1M: 5, outputUsdPer1M: 5 }), // tot 10
        entry({ modelId: 'free', inputUsdPer1M: 0, outputUsdPer1M: 0 }),
      ],
      0.92
    );
    const [top, mid, free] = rows;
    expect(top.barWidthPercent).toBe(100);
    expect(mid.barWidthPercent).toBeCloseTo(50, 6);
    expect(free.barWidthPercent).toBe(0);
  });

  it('cambio EUR null → eur fields null, ma barre fallback su USD canonico', () => {
    const rows = buildCostComparatorRows(
      [
        entry({ modelId: 'top', inputUsdPer1M: 10, outputUsdPer1M: 10 }),
        entry({ modelId: 'mid', inputUsdPer1M: 5, outputUsdPer1M: 5 }),
      ],
      null
    );
    expect(rows[0].inputEurPer1M).toBeNull();
    expect(rows[0].outputEurPer1M).toBeNull();
    expect(rows[0].totalEurPer1M).toBeNull();
    expect(rows[0].barWidthPercent).toBe(100);
    expect(rows[1].barWidthPercent).toBeCloseTo(50, 6);
  });

  it('rawId stabile come key (preferito su composto provider/model)', () => {
    const rows = buildCostComparatorRows(
      [entry({ rawId: 'openai/gpt-4o', modelId: 'gpt-4o', providerId: 'openai' })],
      0.92
    );
    expect(rows[0].key).toBe('openai/gpt-4o');
  });

  it('fallback key su provider/model se rawId è vuoto', () => {
    const it1: LlmPricingEntry = {
      providerId: 'openai',
      modelId: 'gpt-x',
      inputUsdPer1M: 1,
      outputUsdPer1M: 1,
      contextLength: null,
      rawId: '',
    };
    const rows = buildCostComparatorRows([it1], 0.92);
    expect(rows[0].key).toBe('openai/gpt-x');
  });
});

describe('isAboveCostThresholdEur', () => {
  function rowFor(item: LlmPricingEntry, fx: number | null) {
    const [r] = buildCostComparatorRows([item], fx);
    return r;
  }

  it('soglia <= 0 → sempre false (lock disattivato)', () => {
    const r = rowFor(entry({ inputUsdPer1M: 100, outputUsdPer1M: 100 }), 0.92);
    expect(isAboveCostThresholdEur(r, 0)).toBe(false);
    expect(isAboveCostThresholdEur(r, -1)).toBe(false);
  });

  it('modello free → sempre false (anche con soglia bassa)', () => {
    const r = rowFor(entry({ inputUsdPer1M: 0, outputUsdPer1M: 0 }), 0.92);
    expect(isAboveCostThresholdEur(r, 1)).toBe(false);
  });

  it('totale EUR > soglia → true', () => {
    // 30 + 150 USD/M = 180 USD/M; * 0.92 ≈ 165.6 EUR/M → > 10 EUR
    const r = rowFor(entry({ inputUsdPer1M: 30, outputUsdPer1M: 150 }), 0.92);
    expect(isAboveCostThresholdEur(r, 10)).toBe(true);
  });

  it('totale EUR <= soglia → false', () => {
    // 1 + 1 = 2 USD/M → ≈ 1.84 EUR/M ≤ 10
    const r = rowFor(entry({ inputUsdPer1M: 1, outputUsdPer1M: 1 }), 0.92);
    expect(isAboveCostThresholdEur(r, 10)).toBe(false);
  });

  it('confronto stretto: totale = soglia → false (no lock al confine esatto)', () => {
    const r = rowFor(entry({ inputUsdPer1M: 5, outputUsdPer1M: 5 }), 1);
    // total = 10 EUR; 10 > 10 = false
    expect(isAboveCostThresholdEur(r, 10)).toBe(false);
  });

  it('FX n/d → fallback USD: 30+150 = 180 USD > 10 → true', () => {
    const r = rowFor(entry({ inputUsdPer1M: 30, outputUsdPer1M: 150 }), null);
    expect(r.totalEurPer1M).toBeNull();
    expect(isAboveCostThresholdEur(r, 10)).toBe(true);
  });
});

describe('filterPricingByProviders', () => {
  it('include solo i provider nella whitelist', () => {
    const out = filterPricingByProviders(
      [
        entry({ providerId: 'openai', modelId: 'gpt-x' }),
        entry({ providerId: 'groq', modelId: 'llama' }),
        entry({ providerId: 'anthropic', modelId: 'claude' }),
      ],
      new Set<ProviderId>(['openai', 'groq'])
    );
    expect(out.map((i) => i.providerId).sort()).toEqual(['groq', 'openai']);
  });

  it('whitelist vuota → output vuoto', () => {
    const out = filterPricingByProviders(
      [entry({ providerId: 'openai' })],
      new Set<ProviderId>()
    );
    expect(out).toEqual([]);
  });
});
