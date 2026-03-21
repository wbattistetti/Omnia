/**
 * Larghezza minima del CustomNode vuoto (stesso algoritmo di useNodeRendering).
 * Usata anche per `node.width` sui temp node così il centro coincide con l’handle top-target.
 */
const MIN_ABS_PX = 140;
const EMPTY_CHARS = 25;
const HORIZONTAL_PADDING = 40;

function parseNodeRowPx(nodeRowCss: string | undefined): number {
  if (!nodeRowCss) return 14;
  const n = parseFloat(nodeRowCss);
  return Number.isFinite(n) ? n : 14;
}

/**
 * @param nodeRowFontSizePx dimensione font riga in px (es. 14)
 */
export function getEmptyCustomNodeMinWidthPx(nodeRowFontSizePx = 14): number {
  const charWidth = nodeRowFontSizePx * 0.6;
  const minWidth = Math.ceil(EMPTY_CHARS * charWidth + HORIZONTAL_PADDING);
  return Math.max(minWidth, MIN_ABS_PX);
}

/** Accetta `fontSizes.nodeRow` tipo `"14px"` da useDynamicFontSizes. */
export function getEmptyCustomNodeMinWidthFromNodeRowCss(nodeRow: string | undefined): number {
  return getEmptyCustomNodeMinWidthPx(parseNodeRowPx(nodeRow));
}
