/**
 * Metriche testuali per confronto dimensioni del prompt conversazionale (parole / token stimati).
 */

/** Metriche su una stringa di prompt già compilata. */
export interface PromptTextMetrics {
  readonly charCount: number;
  readonly wordCount: number;
  /** Stima token LLM (euristica ~4 caratteri/token su testo latino misto). */
  readonly estimatedTokens: number;
}

/** Conta parole su whitespace (prompt IT/JSON/DSL). */
export function countPromptWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/u).length;
}

/** Stima token senza dipendere da tiktoken (sufficiente per confronto relativo tra formati). */
export function estimatePromptTokens(text: string): number {
  const len = text.length;
  if (len === 0) return 0;
  return Math.max(1, Math.ceil(len / 4));
}

export function measurePromptText(text: string): PromptTextMetrics {
  return {
    charCount: text.length,
    wordCount: countPromptWords(text),
    estimatedTokens: estimatePromptTokens(text),
  };
}

/** Formatta un intero compatto per UI (es. 12400 → "12.4k"). */
export function formatCompactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) {
    const v = n / 1000;
    return v >= 10 ? `${Math.round(v)}k` : `${v.toFixed(1).replace(/\.0$/, '')}k`;
  }
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** Etichetta breve per select menu: parole + token stimati. */
export function formatPromptMetricsLabel(metrics: PromptTextMetrics): string {
  return `${formatCompactCount(metrics.wordCount)} parole · ~${formatCompactCount(metrics.estimatedTokens)} tok`;
}

/** Confronto catalogo vs JSON completo (percentuale risparmio token sul solo catalogo). */
export function formatCatalogComparisonLabel(
  catalog: PromptTextMetrics,
  savingsPercentVsPretty: number
): string {
  const pct = Math.abs(Math.round(savingsPercentVsPretty));
  const sign = savingsPercentVsPretty >= 0 ? '−' : '+';
  return `~${formatCompactCount(catalog.estimatedTokens)} tok cat. (${sign}${pct}%)`;
}
