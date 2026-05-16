/**
 * Metriche layout per l’albero backend compatto (SEND/RECEIVE): indent, slot chevron/freccia, inset pannelli.
 */

/** Indent per livello sotto radice accordion. */
export const BACKEND_TREE_INDENT_PX = 12;

/** Slot fisso chevron espansione (non si allarga con flex-1). */
export const BACKEND_TREE_CHEVRON_SLOT_PX = 14;

/** Stima larghezza glyph freccia per inset pannelli (la riga non usa colonne fisse). */
export const BACKEND_TREE_ARROW_GLYPH_ESTIMATE_PX = 42;

/** @deprecated Usare BACKEND_TREE_ARROW_GLYPH_ESTIMATE_PX; mantenuto per test di migrazione inset. */
export const BACKEND_TREE_ARROW_SLOT_PX = BACKEND_TREE_ARROW_GLYPH_ESTIMATE_PX;

export function backendTreeDepthIndentPx(depth: number): number {
  return Math.max(0, depth) * BACKEND_TREE_INDENT_PX;
}

/** Inset pannello «Dominio valori» allineato al nome parametro (layout albero pulito). */
export function backendDominioValoriCleanTreeInsetPx(opts: {
  depth: number;
  showAdvancementUi: boolean;
  hasOpenApiDrift: boolean;
}): number {
  const depthPad = backendTreeDepthIndentPx(opts.depth);
  const adv = opts.showAdvancementUi ? 22 : 0;
  const drift = opts.hasOpenApiDrift ? 18 : 0;
  return (
    depthPad +
    BACKEND_TREE_CHEVRON_SLOT_PX +
    BACKEND_TREE_ARROW_SLOT_PX +
    adv +
    drift
  );
}
