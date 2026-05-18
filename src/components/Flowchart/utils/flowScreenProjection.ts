/**
 * Screen ↔ flow projection using viewport transform + pane rect (no RF store width/height).
 */

import type { Viewport } from 'reactflow';
import { isFiniteCoord } from './flowPositionGuards';

export type PaneScreenRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function paneRectFromElement(el: HTMLElement | null): PaneScreenRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** clientX/Y → flow coords; works when RF store dimensions are stale (error #004). */
export function screenPointToFlow(
  clientX: number,
  clientY: number,
  viewport: Viewport,
  pane: PaneScreenRect
): { x: number; y: number } | null {
  const zoom = viewport.zoom;
  if (!isFiniteCoord(zoom) || zoom <= 0) return null;
  if (!isFiniteCoord(viewport.x) || !isFiniteCoord(viewport.y)) return null;
  const x = (clientX - pane.left - viewport.x) / zoom;
  const y = (clientY - pane.top - viewport.y) / zoom;
  if (!isFiniteCoord(x) || !isFiniteCoord(y)) return null;
  return { x, y };
}

export function flowPointToScreen(
  flowX: number,
  flowY: number,
  viewport: Viewport,
  pane: PaneScreenRect
): { x: number; y: number } | null {
  const zoom = viewport.zoom;
  if (!isFiniteCoord(zoom) || zoom <= 0) return null;
  const x = flowX * zoom + viewport.x + pane.left;
  const y = flowY * zoom + viewport.y + pane.top;
  if (!isFiniteCoord(x) || !isFiniteCoord(y)) return null;
  return { x, y };
}
