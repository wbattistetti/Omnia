/**
 * Testo dinamico percorso «Genera use case» nello stato vuoto (solo ciò che il task ha davvero).
 */

export type EmptyTutorGenerateContext = {
  hasDesignDescription: boolean;
  hasKbDocuments: boolean;
  hasBackend: boolean;
};

export type EmptyTutorGenerateHintLines = {
  /** Dopo «Clicca qui e » — prima riga. */
  actionPhrase: string;
  /** Seconda riga (fonti / fallback). */
  basesPhrase: string;
};

function joinItalianList(parts: readonly string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

/** Due righe bilanciate per il blocco CTA centrato. */
export function buildEmptyTutorGenerateHintLines(
  ctx: EmptyTutorGenerateContext
): EmptyTutorGenerateHintLines {
  const sources: string[] = [];
  if (ctx.hasDesignDescription) sources.push('della descrizione che hai indicato');
  if (ctx.hasKbDocuments) sources.push('dei documenti che hai caricato');
  if (ctx.hasBackend) sources.push('dei back-end che hai caricato');

  if (sources.length === 0) {
    return {
      actionPhrase: 'rigeneriamo da zero',
      basesPhrase: 'quando avrai indicato la descrizione del task.',
    };
  }

  return {
    actionPhrase: 'rigeneriamo da zero',
    basesPhrase: `sulla base ${joinItalianList(sources)}.`,
  };
}

/** Parte dopo «Clicca qui e » (stringa continua, per compat). */
export function buildEmptyTutorGenerateHintSuffix(ctx: EmptyTutorGenerateContext): string {
  const { actionPhrase, basesPhrase } = buildEmptyTutorGenerateHintLines(ctx);
  return `${actionPhrase} ${basesPhrase}`;
}
