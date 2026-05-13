/**
 * Helper di dominio per la sezione "Cost comparator" della pagina LLM settings.
 *
 * Logica pura — niente React, niente fetch, niente accesso a `window`. Tutte le
 * trasformazioni che dovranno essere coperte da test (ordinamento, conversione
 * USD→EUR, classificazione free / n.d., normalizzazione barre) vivono qui.
 *
 * Decisioni di prodotto (2026-05-13, designer):
 *  - L'unica divisa di display è EUR (default progetto). USD resta sorgente canonica
 *    nei tipi (`LlmPricingEntry.inputUsdPer1M`) ma l'utente non lo vede mai in colonna.
 *  - Modello "free" = `inputUsdPer1M === 0 && outputUsdPer1M === 0` → mostriamo "free".
 *  - Cambio EUR non disponibile (`usdToEur === null`) → ogni colonna €/M mostra "n/d";
 *    le barre non vengono renderizzate perché senza un metro comparativo l'astrazione
 *    grafica è ingannevole.
 *  - Ordinamento default: costo totale per 1M (`input + output` in EUR, con USD come
 *    proxy quando il cambio non c'è) DESCRESCENTE. Free in fondo (vengono in coda
 *    naturalmente perché hanno totale 0 → ordinati per nome modello tra di loro).
 *  - Barra: larghezza proporzionale al `totalCostPer1M` di riga rispetto al `max`
 *    della tabella visibile. Modelli free → barra a 0%.
 */

import type { LlmPricingEntry } from '@services/aiCallsApi';

export type ProviderId = LlmPricingEntry['providerId'];

export interface CostComparatorRow {
  /** Stable React key — coincide con `rawId` di OpenRouter (`provider/model`). */
  readonly key: string;
  readonly providerId: ProviderId;
  readonly modelId: string;
  /** USD canonico per 1M token, lasciato per tooltip/diagnostica. */
  readonly inputUsdPer1M: number;
  readonly outputUsdPer1M: number;
  /** EUR per 1M token (null se cambio non disponibile). */
  readonly inputEurPer1M: number | null;
  readonly outputEurPer1M: number | null;
  /** EUR totale (input+output) per 1M; null se cambio mancante. */
  readonly totalEurPer1M: number | null;
  /** Larghezza della barra comparativa in percentuale (0..100). */
  readonly barWidthPercent: number;
  readonly isFree: boolean;
}

/**
 * Modello "free": entrambi i prezzi a 0 USD/M. Tipico dei modelli sponsorizzati o di
 * preview gratuite (es. alcuni endpoint Groq, Gemini Flash free tier).
 */
export function isFreePricing(entry: LlmPricingEntry): boolean {
  return entry.inputUsdPer1M === 0 && entry.outputUsdPer1M === 0;
}

/**
 * Converte USD → EUR via cambio cached. Restituisce `null` quando il cambio non è
 * disponibile, così il consumer mostra "n/d" invece di un valore inventato.
 */
export function usdToEurOrNull(valueUsd: number, usdToEur: number | null): number | null {
  if (usdToEur === null || !Number.isFinite(usdToEur)) return null;
  return valueUsd * usdToEur;
}

/**
 * Costruisce le righe del comparatore a partire dal catalogo pricing e dal cambio.
 *
 * @param items   catalogo pricing live (già filtrato per provider lato chiamante quando serve)
 * @param usdToEur cambio cached (può essere null)
 * @returns righe ordinate per `totalEurPer1M` desc; modelli free in fondo, ordinati alfabeticamente
 */
export function buildCostComparatorRows(
  items: readonly LlmPricingEntry[],
  usdToEur: number | null
): CostComparatorRow[] {
  if (items.length === 0) return [];

  const enriched = items.map<CostComparatorRow>((it) => {
    const isFree = isFreePricing(it);
    const inputEur = usdToEurOrNull(it.inputUsdPer1M, usdToEur);
    const outputEur = usdToEurOrNull(it.outputUsdPer1M, usdToEur);
    const totalEur =
      inputEur === null || outputEur === null ? null : inputEur + outputEur;
    return {
      key: it.rawId || `${it.providerId}/${it.modelId}`,
      providerId: it.providerId,
      modelId: it.modelId,
      inputUsdPer1M: it.inputUsdPer1M,
      outputUsdPer1M: it.outputUsdPer1M,
      inputEurPer1M: inputEur,
      outputEurPer1M: outputEur,
      totalEurPer1M: totalEur,
      barWidthPercent: 0,
      isFree,
    };
  });

  /** Massimo "metro" per la barra. Se EUR n/d, fallback su USD per non perdere il segnale comparativo. */
  const metricFor = (r: CostComparatorRow): number =>
    r.totalEurPer1M !== null
      ? r.totalEurPer1M
      : r.inputUsdPer1M + r.outputUsdPer1M;
  const maxMetric = enriched.reduce((acc, r) => Math.max(acc, metricFor(r)), 0);

  /** Barra: 0..100% proporzionale al metro di riga; free → 0%. */
  for (const r of enriched) {
    if (r.isFree || maxMetric <= 0) {
      (r as { barWidthPercent: number }).barWidthPercent = 0;
      continue;
    }
    const m = metricFor(r);
    (r as { barWidthPercent: number }).barWidthPercent = Math.min(
      100,
      Math.max(0, (m / maxMetric) * 100)
    );
  }

  /**
   * Ordinamento: costo totale DESC (free in fondo perché 0). Tie-break per nome
   * modello ASC, così la lista è stabile tra refresh con stessi prezzi.
   */
  enriched.sort((a, b) => {
    const ma = metricFor(a);
    const mb = metricFor(b);
    if (mb !== ma) return mb - ma;
    return a.modelId.localeCompare(b.modelId);
  });

  return enriched;
}

/**
 * Filtro per provider — utile quando la pagina settings vuole mostrare solo i
 * provider effettivamente abilitati nel Tutor (oggi: openai, groq).
 * Predicato pure: nessuna mutazione dell'input.
 */
export function filterPricingByProviders(
  items: readonly LlmPricingEntry[],
  allowed: ReadonlySet<ProviderId>
): LlmPricingEntry[] {
  return items.filter((it) => allowed.has(it.providerId));
}

/**
 * True se il costo totale per 1M token (input + output) della riga **eccede**
 * la soglia EUR fornita. Usato dalla `CostComparatorTable` per decidere quando
 * mostrare il lucchetto sulla riga (policy "modelli premium": il designer
 * deve confermare con password prima di selezionarli).
 *
 * Regole:
 *  - `thresholdEur <= 0` → sempre `false` (lock disattivato).
 *  - Modello free → `false` (non ha senso lockare un modello a costo zero).
 *  - Cambio EUR disponibile → confronta `totalEurPer1M > thresholdEur`.
 *  - Cambio EUR n/d → fallback su USD canonico (`input + output` USD/M),
 *    coerente con la barra comparativa: senza FX dobbiamo comunque dare al
 *    designer una difesa "fail-safe", non spalancare l'accesso a tutti i modelli.
 *
 * Pure: nessun side-effect, deterministico.
 */
export function isAboveCostThresholdEur(
  row: CostComparatorRow,
  thresholdEur: number
): boolean {
  if (!Number.isFinite(thresholdEur) || thresholdEur <= 0) return false;
  if (row.isFree) return false;
  if (row.totalEurPer1M !== null) return row.totalEurPer1M > thresholdEur;
  return row.inputUsdPer1M + row.outputUsdPer1M > thresholdEur;
}
