/**
 * Metriche layout per l’albero backend compatto (SEND/RECEIVE): indent, slot chevron/freccia, inset pannelli.
 */

/** Indent per livello sotto radice accordion. */
export const BACKEND_TREE_INDENT_PX = 12;

/** Slot fisso chevron espansione (non si allarga con flex-1). */
export const BACKEND_TREE_CHEVRON_SLOT_PX = 14;

/** Slot freccia parametro (glyph compatto centrato; larghezza ~2× rispetto alla v1). */
export const BACKEND_TREE_ARROW_SLOT_PX = 80;

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
