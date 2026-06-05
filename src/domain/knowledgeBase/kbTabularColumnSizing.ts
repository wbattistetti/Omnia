/**
 * Larghezza colonne tabella KB in unità ch, adattata al contenuto (no stretch a tutta la viewport).
 */

export type KbTabularColumnWidthOptions = {
  minCh?: number;
  maxCh?: number;
  paddingCh?: number;
};

/** Larghezza colonna in ch in base a header e celle (con cap min/max). */
export function kbTabularColumnWidthCh(
  header: string,
  columnCells: readonly string[],
  options: KbTabularColumnWidthOptions = {}
): number {
  const minCh = options.minCh ?? 3;
  const maxCh = options.maxCh ?? 42;
  const paddingCh = options.paddingCh ?? 1;

  let maxLen = header.trim().length;
  for (const cell of columnCells) {
    const v = (cell ?? '').trim();
    if (v) maxLen = Math.max(maxLen, v.length);
  }
  if (maxLen === 0) maxLen = minCh;

  return Math.min(maxCh, Math.max(minCh, maxLen + paddingCh));
}

/** Larghezza input/cella editabile: almeno la colonna, cresce con il testo digitato. */
export function kbTabularEditableFieldWidthCh(
  columnWidthCh: number,
  text: string,
  options: KbTabularColumnWidthOptions = {}
): number {
  const maxCh = options.maxCh ?? 42;
  const minCh = options.minCh ?? 3;
  const len = Math.max(text.length, 1);
  return Math.min(maxCh, Math.max(columnWidthCh, minCh, len + 1));
}
