/**
 * Costanti e metriche di layout per il pannello «Dominio valori» nel mapping backend
 * (allineamento label rispetto al gutter della riga parametro).
 */

export const BACKEND_DOMINIO_VALORI_LABEL = 'Dominio valori';

/** Inset approssimato per allineare il blocco al testo del nome (gutter riga backend). */
export function backendDominioValoriLabelInsetPx(opts: {
  showAdvancementUi: boolean;
  hasOpenApiDrift: boolean;
}): number {
  const rowPadL = 2;
  const chevron = 16;
  const g1 = 2;
  const arrow = 62;
  const g2 = 2;
  const adv = opts.showAdvancementUi ? 30 + 2 : 0;
  const drift = opts.hasOpenApiDrift ? 22 + 2 : 0;
  return rowPadL + chevron + g1 + arrow + g2 + adv + drift;
}
