/**
 * Maps the on-screen viewport host to a flow-coordinate visible rectangle.
 */

import type { ReactFlowInstance } from 'reactflow';
import type { FlowRect } from './flowGraphBounds';
import { resolveFlowPaneElement } from '../utils/flowCanvasDom';

export type ScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** Visible flow bounds from screen corners via React Flow projection. */
export function visibleFlowRectFromScreen(
  instance: Pick<ReactFlowInstance, 'screenToFlowPosition'>,
  screen: ScreenRect
): FlowRect {
  const tl = instance.screenToFlowPosition({ x: screen.left, y: screen.top });
  const br = instance.screenToFlowPosition({ x: screen.right, y: screen.bottom });
  return {
    minX: Math.min(tl.x, br.x),
    minY: Math.min(tl.y, br.y),
    maxX: Math.max(tl.x, br.x),
    maxY: Math.max(tl.y, br.y),
  };
}

export function screenRectFromElement(el: HTMLElement | null): ScreenRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/** Visible RF pane inside a flow canvas host (not the full dock tab chrome). */
export function screenRectFromFlowCanvasHost(host: HTMLElement | null): ScreenRect | null {
  if (!host) return null;
  return screenRectFromElement(resolveFlowPaneElement(host) ?? host);
}
