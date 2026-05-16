/**
 * Costanti e metriche di layout per il pannello «Dominio valori» nel mapping backend
 * (allineamento label rispetto al gutter della riga parametro).
 */

export const BACKEND_DOMINIO_VALORI_LABEL = 'Dominio valori';

/** Inset approssimato per allineare il blocco al testo del nome (gutter riga backend). */
export function backendDominioValoriLabelInsetPx(opts: {
  showAdvancementUi: boolean;
  hasOpenApiDrift: boolean;
  /** Con griglia flat: larghezza binario ad albero (px); se assente si usa euristica legacy. */
  treeRailWidthPx?: number;
  /** Griglia flat: indentazione cumulativa per profondità (`depth * step` in `FlowMappingTree`). */
  treeDepthIndentPx?: number;
}): number {
  const rowPadL = 2;
  const depthPad = typeof opts.treeDepthIndentPx === 'number' ? opts.treeDepthIndentPx : 0;
  const rail = typeof opts.treeRailWidthPx === 'number' ? opts.treeRailWidthPx : 18;
  /** Larghezza colonna freccia SEND/RECEIVE in `FlowMappingTree` (w-14). */
  const arrowW = 56;
  const gapRailArrow = 0;
  const adv = opts.showAdvancementUi ? 30 + 2 : 0;
  const drift = opts.hasOpenApiDrift ? 22 + 2 : 0;
  return rowPadL + depthPad + rail + gapRailArrow + arrowW + adv + drift;
}
