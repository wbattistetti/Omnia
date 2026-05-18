/**
 * PanZoom visibility — show when any node extends outside the viewport (even slightly).
 */

import type { Node } from 'reactflow';
import { resolveFlowPaneElement } from '../utils/flowCanvasDom';
import { paneRectFromElement, screenPointToFlow } from '../utils/flowScreenProjection';
import { nodesHaveFinitePositions } from '../utils/flowPositionGuards';
import { hasAnyNodeDomPartiallyOutsidePane } from './flowNodeScreenBounds';
import {
  hasAnyNodeOutsideFlowRect,
  visibleFlowRectFromViewportStore,
  type FlowRect,
} from './flowGraphBounds';

export type FlowPanZoomStoreSlice = {
  transform: [number, number, number];
  width: number;
  height: number;
};

/** Show panzoom as soon as any pixel of a node footprint is outside the viewport (no slack). */
const SHOW_OUTSIDE_EPSILON_FLOW_PX = 0;

function viewportFromTransform(t: [number, number, number]): {
  x: number;
  y: number;
  zoom: number;
} {
  return { x: t[0], y: t[1], zoom: t[2] };
}

function visibleFlowRectFromDom(
  host: HTMLElement | null,
  viewport: { x: number; y: number; zoom: number }
): FlowRect | null {
  const pane = paneRectFromElement(resolveFlowPaneElement(host));
  if (!pane) return null;
  const tl = screenPointToFlow(pane.left, pane.top, viewport, pane);
  const br = screenPointToFlow(pane.left + pane.width, pane.top + pane.height, viewport, pane);
  if (!tl || !br) return null;
  return {
    minX: Math.min(tl.x, br.x),
    minY: Math.min(tl.y, br.y),
    maxX: Math.max(tl.x, br.x),
    maxY: Math.max(tl.y, br.y),
  };
}

/**
 * True when any node (or its measured DOM box) is not fully inside the visible viewport.
 */
export function computeFlowPanZoomNeeded(
  nodes: readonly Node[],
  store: FlowPanZoomStoreSlice,
  host: HTMLElement | null
): boolean {
  if (nodes.length === 0 || !nodesHaveFinitePositions(nodes)) return false;

  const vp = viewportFromTransform(store.transform);
  if (!(vp.zoom > 0 && Number.isFinite(vp.zoom))) return false;

  const visible =
    visibleFlowRectFromViewportStore(vp, store.width, store.height) ??
    visibleFlowRectFromDom(host, vp);
  if (!visible) return false;

  if (hasAnyNodeOutsideFlowRect(nodes, visible, SHOW_OUTSIDE_EPSILON_FLOW_PX)) {
    return true;
  }

  if (host && hasAnyNodeDomPartiallyOutsidePane(host, 0)) {
    return true;
  }

  return false;
}
