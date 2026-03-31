/**
 * Shared column width math for TesterGrid header, colgroup, and body cells.
 */

export function calculateEngineColumnWidth(totalColumns: number): number {
  if (totalColumns === 0) return 200;
  const minColumnWidth = 220;
  const estimatedTotalWidth = 1200;
  const fixedWidth = 440;
  const availableWidth = estimatedTotalWidth - fixedWidth;
  return Math.max(minColumnWidth, Math.floor(availableWidth / totalColumns));
}
