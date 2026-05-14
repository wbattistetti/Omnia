/**
 * Orthogonal edge routing utilities.
 * Vertical stack (bottom↔top): trunk on the **source** handle X (parent center),
 * then a short horizontal to the target if Δx > ε — avoids a midpoint X that misaligns the start.
 */

/**
 * Optional React Flow handle positions ('bottom' | 'top' | 'left' | 'right').
 * When provided, routing can prefer a straight segment for aligned stacks.
 */
export type OrthoPortHint = {
  sourcePosition?: string | null;
  targetPosition?: string | null;
};

/**
 * Derive side names from React Flow handle ids (e.g. `top-target` → `top`).
 */
export function orthoPortHintFromHandleIds(
  sourceHandle?: string | null,
  targetHandle?: string | null,
): OrthoPortHint | undefined {
  const sp = handleIdToSide(sourceHandle);
  const tp = handleIdToSide(targetHandle);
  if (!sp || !tp) return undefined;
  return { sourcePosition: sp, targetPosition: tp };
}

function handleIdToSide(id?: string | null): string | undefined {
  if (id == null) return undefined;
  const t = String(id).trim();
  if (!t) return undefined;
  const base = t.endsWith('-target') ? t.slice(0, -'-target'.length) : t;
  const allowed = new Set(['top', 'bottom', 'left', 'right']);
  return allowed.has(base) ? base : undefined;
}

function normalizeSide(p?: string | null): string | undefined {
  if (p == null) return undefined;
  const s = String(p).trim().toLowerCase();
  if (!s) return undefined;
  const allowed = new Set(['top', 'bottom', 'left', 'right']);
  return allowed.has(s) ? s : undefined;
}

/**
 * True when handles are a vertical stack (bottom→top or top→bottom) and |dy| ≥ |dx|,
 * so a trunk-first path (vertical at source X, short horizontal to target) beats full VHV.
 */
export function isStraightVerticalStackFlow(
  ports: OrthoPortHint | undefined,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): boolean {
  if (!ports) return false;
  const sp = normalizeSide(ports.sourcePosition);
  const tp = normalizeSide(ports.targetPosition);
  if (!sp || !tp) return false;
  const verticalPair =
    (sp === 'bottom' && tp === 'top') || (sp === 'top' && tp === 'bottom');
  if (!verticalPair) return false;
  return Math.abs(ty - sy) >= Math.abs(tx - sx);
}

/**
 * True for left↔right ports when |dx| ≥ |dy| — trunk on source Y, short vertical to target if needed.
 */
export function isStraightHorizontalBridgeFlow(
  ports: OrthoPortHint | undefined,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): boolean {
  if (!ports) return false;
  const sp = normalizeSide(ports.sourcePosition);
  const tp = normalizeSide(ports.targetPosition);
  if (!sp || !tp) return false;
  const horizontalPair =
    (sp === 'right' && tp === 'left') || (sp === 'left' && tp === 'right');
  if (!horizontalPair) return false;
  return Math.abs(tx - sx) >= Math.abs(ty - sy);
}

/** Sotto questa distanza orizzontale (coord. flow/screen) il VHV collassa in un segmento verticale. */
export const VHV_COLLINEAR_EPS_PX = 12;

/** Raggio default agli angoli HVH/VHV arrotondati (allineato a SmoothStep borderRadius). */
export const ORTHO_CORNER_RADIUS_PX = 8;

const MIN_FILLET_PX = 0.5;

/** Vertical stack: vertical leg at source X, optional horizontal run to target X. */
function verticalStackDominantPath(sx: number, sy: number, tx: number, ty: number): string {
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    const x = (sx + tx) / 2;
    return `M ${x},${sy} L ${x},${ty}`;
  }
  return `M ${sx},${sy} L ${sx},${ty} L ${tx},${ty}`;
}

/** Horizontal stack: horizontal leg at source Y, optional vertical run to target Y. */
function horizontalStackDominantPath(sx: number, sy: number, tx: number, ty: number): string {
  if (Math.abs(ty - sy) <= VHV_COLLINEAR_EPS_PX) {
    const y = (sy + ty) / 2;
    return `M ${sx},${y} L ${tx},${y}`;
  }
  return `M ${sx},${sy} L ${tx},${sy} L ${tx},${ty}`;
}

function balanceCornerRadiiOnSpan(r1: number, r2: number, span: number): [number, number] {
  if (span <= MIN_FILLET_PX) return [0, 0];
  if (r1 + r2 <= span) return [r1, r2];
  const s = (span * 0.99) / (r1 + r2);
  return [r1 * s, r2 * s];
}

/**
 * Punto flow di fallback per etichetta edge in stile VHV (allineato al path effettivo).
 */
export function defaultVHVLabelFallbackFlow(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  ports?: OrthoPortHint,
): { x: number; y: number } {
  if (isStraightVerticalStackFlow(ports, sx, sy, tx, ty)) {
    if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
      return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
    }
    return { x: sx, y: (sy + ty) / 2 };
  }
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
  }
  const midY = (sy + ty) / 2;
  return { x: tx, y: (midY + ty) / 2 };
}

/**
 * Restituisce il punto medio sulla polilinea VHV generata da getVHVPath (stessa geometria con `ports`).
 */
export function midpointOnVHVPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  ports?: OrthoPortHint,
): { x: number; y: number } {
  if (isStraightVerticalStackFlow(ports, sx, sy, tx, ty)) {
    if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
      return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
    }
    return { x: sx, y: (sy + ty) / 2 };
  }
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
  }
  const midY = (sy + ty) / 2;
  return { x: (sx + tx) / 2, y: midY };
}

/**
 * Punto flow per ancorare l'editor condizione / intellisense sul link.
 */
export function intellisenseAnchorFlowFromHandles(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  ports?: OrthoPortHint,
): { x: number; y: number } {
  if (isStraightVerticalStackFlow(ports, sx, sy, tx, ty)) {
    return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
  }
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    return { x: sx, y: (sy + ty) / 2 };
  }
  return midpointOnVHVPath(sx, sy, tx, ty, ports);
}

export function getVHVPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  ports?: OrthoPortHint,
): string {
  if (isStraightVerticalStackFlow(ports, sx, sy, tx, ty)) {
    return verticalStackDominantPath(sx, sy, tx, ty);
  }
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    const x = (sx + tx) / 2;
    return `M ${x},${sy} L ${x},${ty}`;
  }
  const midY = (sy + ty) / 2;
  return `M ${sx},${sy} L ${sx},${midY} L ${tx},${midY} L ${tx},${ty}`;
}

export function getHVHPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  ports?: OrthoPortHint,
): string {
  if (isStraightHorizontalBridgeFlow(ports, sx, sy, tx, ty)) {
    return horizontalStackDominantPath(sx, sy, tx, ty);
  }
  const midX = (sx + tx) / 2;
  return `M ${sx},${sy} L ${midX},${sy} L ${midX},${ty} L ${tx},${ty}`;
}

/**
 * Automatically selects between VHV and HVH based on geometry
 * - If vertical distance (dy) > horizontal distance (dx) → uses VHV
 * - Otherwise → uses HVH
 */
export function getAutoOrthoPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  ports?: OrthoPortHint,
): string {
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);

  if (dy > dx) {
    return getVHVPath(sx, sy, tx, ty, ports);
  }
  return getHVHPath(sx, sy, tx, ty, ports);
}

/**
 * VHV con vertici arrotondati (Bezier quadratiche `Q`, control point sul vertice ideale).
 */
export function getRoundedVHVPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  radius: number = ORTHO_CORNER_RADIUS_PX,
  ports?: OrthoPortHint,
): string {
  if (isStraightVerticalStackFlow(ports, sx, sy, tx, ty)) {
    return verticalStackDominantPath(sx, sy, tx, ty);
  }
  if (Math.abs(tx - sx) <= VHV_COLLINEAR_EPS_PX) {
    const x = (sx + tx) / 2;
    return `M ${x},${sy} L ${x},${ty}`;
  }
  if (Math.abs(sy - ty) < MIN_FILLET_PX) {
    return getVHVPath(sx, sy, tx, ty, ports);
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
    return getVHVPath(sx, sy, tx, ty, ports);
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
  radius: number = ORTHO_CORNER_RADIUS_PX,
  ports?: OrthoPortHint,
): string {
  if (isStraightHorizontalBridgeFlow(ports, sx, sy, tx, ty)) {
    return horizontalStackDominantPath(sx, sy, tx, ty);
  }
  if (Math.abs(sy - ty) < MIN_FILLET_PX) {
    return getHVHPath(sx, sy, tx, ty, ports);
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
    return getHVHPath(sx, sy, tx, ty, ports);
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
  radius: number = ORTHO_CORNER_RADIUS_PX,
  ports?: OrthoPortHint,
): string {
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);
  if (dy > dx) {
    return getRoundedVHVPath(sx, sy, tx, ty, radius, ports);
  }
  return getRoundedHVHPath(sx, sy, tx, ty, radius, ports);
}
