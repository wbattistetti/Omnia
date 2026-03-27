/**
 * Orthogonal edge routing utilities
 * Provides functions for generating orthogonal (90-degree) edge paths
 */

/**
 * Generates a Vertical-Horizontal-Vertical (VHV) orthogonal path
 * Pattern: Down/Up → Right/Left → Down/Up
 *
 * @param sx - Source X coordinate
 * @param sy - Source Y coordinate
 * @param tx - Target X coordinate
 * @param ty - Target Y coordinate
 * @returns SVG path string in compact format
 */
/** Sotto questa distanza orizzontale (coord. flow/screen) il VHV collassa in un segmento verticale. */
export const VHV_COLLINEAR_EPS_PX = 12;

/** Raggio default agli angoli HVH/VHV arrotondati (allineato a SmoothStep borderRadius). */
export const ORTHO_CORNER_RADIUS_PX = 8;

const MIN_FILLET_PX = 0.5;

function balanceCornerRadiiOnSpan(r1: number, r2: number, span: number): [number, number] {
  if (span <= MIN_FILLET_PX) return [0, 0];
  if (r1 + r2 <= span) return [r1, r2];
  const s = (span * 0.99) / (r1 + r2);
  return [r1 * s, r2 * s];
}

/**
 * Restituisce il punto medio sulla polilinea VHV generata da getVHVPath.
 * Usato per allineare l'editor di condizione al segmento realmente disegnato.
 */
export function midpointOnVHVPath(
  sx: number, sy: number,
  tx: number, ty: number,
): { x: number; y: number } {
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    // segmento verticale: la linea corre a x = (sx+tx)/2
    return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
  }
  // VHV: tre segmenti verticale-orizzontale-verticale; il midpoint cade sul tratto orizzontale
  const midY = (sy + ty) / 2;
  return { x: (sx + tx) / 2, y: midY };
}

/**
 * Punto flow per ancorare l’editor condizione: colonna verticale → X handle sorgente, Y metà segmento;
 * altrimenti centro polilinea VHV come il path disegnato.
 */
export function intellisenseAnchorFlowFromHandles(
  sx: number, sy: number, tx: number, ty: number,
): { x: number; y: number } {
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    return { x: sx, y: (sy + ty) / 2 };
  }
  return midpointOnVHVPath(sx, sy, tx, ty);
}

export function getVHVPath(sx: number, sy: number, tx: number, ty: number): string {
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    const x = (sx + tx) / 2;
    return `M ${x},${sy} L ${x},${ty}`;
  }
  const midY = (sy + ty) / 2;
  return `M ${sx},${sy} L ${sx},${midY} L ${tx},${midY} L ${tx},${ty}`;
}

/**
 * Generates a Horizontal-Vertical-Horizontal (HVH) orthogonal path
 * Pattern: Right/Left → Down/Up → Right/Left
 *
 * @param sx - Source X coordinate
 * @param sy - Source Y coordinate
 * @param tx - Target X coordinate
 * @param ty - Target Y coordinate
 * @returns SVG path string in compact format
 */
export function getHVHPath(sx: number, sy: number, tx: number, ty: number): string {
  const midX = (sx + tx) / 2;
  return `M ${sx},${sy} L ${midX},${sy} L ${midX},${ty} L ${tx},${ty}`;
}

/**
 * Automatically selects between VHV and HVH based on geometry
 * - If vertical distance (dy) > horizontal distance (dx) → uses VHV
 * - Otherwise → uses HVH
 *
 * This ensures the path follows the longer dimension first for better visual flow.
 *
 * @param sx - Source X coordinate
 * @param sy - Source Y coordinate
 * @param tx - Target X coordinate
 * @param ty - Target Y coordinate
 * @returns SVG path string in compact format
 */
export function getAutoOrthoPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);

  if (dy > dx) {
    // Vertical distance is greater → use VHV (Vertical-Horizontal-Vertical)
    return getVHVPath(sx, sy, tx, ty);
  } else {
    // Horizontal distance is greater or equal → use HVH (Horizontal-Vertical-Horizontal)
    return getHVHPath(sx, sy, tx, ty);
  }
}

/**
 * VHV con vertici arrotondati (Bezier quadratiche `Q`, control point sul vertice ideale).
 */
export function getRoundedVHVPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  radius: number = ORTHO_CORNER_RADIUS_PX
): string {
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    const x = (sx + tx) / 2;
    return `M ${x},${sy} L ${x},${ty}`;
  }
  if (Math.abs(sy - ty) < MIN_FILLET_PX) {
    return getVHVPath(sx, sy, tx, ty);
  }

  const midY = (sy + ty) / 2;
  const dx = tx - sx;
  const dy1 = midY - sy;
  const signV1 = Math.sign(dy1) || 1;
  const signH = Math.sign(dx) || 1;
  const signV2 = Math.sign(ty - midY) || 1;

  let r1 = Math.min(radius, Math.abs(dy1) / 2, Math.abs(dx) / 2);
  let r2 = Math.min(radius, Math.abs(ty - midY) / 2, Math.abs(dx) / 2);
  [r1, r2] = balanceCornerRadiiOnSpan(r1, r2, Math.abs(dx));

  if (r1 < MIN_FILLET_PX || r2 < MIN_FILLET_PX) {
    return getVHVPath(sx, sy, tx, ty);
  }

  const yBefore1 = midY - r1 * signV1;
  const xAfter1 = sx + signH * r1;
  const xBefore2 = tx - signH * r2;
  const yAfter2 = midY + signV2 * r2;

  return `M ${sx},${sy} L ${sx},${yBefore1} Q ${sx},${midY} ${xAfter1},${midY} L ${xBefore2},${midY} Q ${tx},${midY} ${tx},${yAfter2} L ${tx},${ty}`;
}

/**
 * HVH con vertici arrotondati (Bezier quadratiche `Q`).
 */
export function getRoundedHVHPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  radius: number = ORTHO_CORNER_RADIUS_PX
): string {
  if (Math.abs(sy - ty) < MIN_FILLET_PX) {
    return getHVHPath(sx, sy, tx, ty);
  }

  const midX = (sx + tx) / 2;
  const dy = ty - sy;
  const dx1 = midX - sx;
  const dx2 = tx - midX;
  const signH1 = Math.sign(dx1) || 1;
  const signV = Math.sign(dy) || 1;
  const signH2 = Math.sign(dx2) || 1;

  let r1 = Math.min(radius, Math.abs(dx1) / 2, Math.abs(dy) / 2);
  let r2 = Math.min(radius, Math.abs(dx2) / 2, Math.abs(dy) / 2);
  [r1, r2] = balanceCornerRadiiOnSpan(r1, r2, Math.abs(dy));

  if (r1 < MIN_FILLET_PX || r2 < MIN_FILLET_PX) {
    return getHVHPath(sx, sy, tx, ty);
  }

  const xBefore1 = midX - r1 * signH1;
  const yAfter1 = sy + r1 * signV;
  const yBefore2 = ty - r2 * signV;
  const xAfter2 = midX + r2 * signH2;

  return `M ${sx},${sy} L ${xBefore1},${sy} Q ${midX},${sy} ${midX},${yAfter1} L ${midX},${yBefore2} Q ${midX},${ty} ${xAfter2},${ty} L ${tx},${ty}`;
}

/**
 * Auto-ortho con angoli arrotondati (stessa logica di getAutoOrthoPath).
 */
export function getRoundedAutoOrthoPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  radius: number = ORTHO_CORNER_RADIUS_PX
): string {
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);
  if (dy > dx) {
    return getRoundedVHVPath(sx, sy, tx, ty, radius);
  }
  return getRoundedHVHPath(sx, sy, tx, ty, radius);
}
