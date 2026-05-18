/**
 * PanZoom visibility via React Flow getNodesBounds + store viewport.
 */

import { getNodesBounds, type Node } from 'reactflow';
import { resolveFlowPaneElement } from '../utils/flowCanvasDom';
import { paneRectFromElement, screenPointToFlow } from '../utils/flowScreenProjection';
import { nodesHaveFinitePositions } from '../utils/flowPositionGuards';
import {
  isFlowRectFullyInside,
  visibleFlowRectFromViewportStore,
  type FlowRect,
} from './flowGraphBounds';

export type FlowPanZoomStoreSlice = {
  transform: [number, number, number];
  width: number;
  height: number;
};

const VISIBILITY_MARGIN_FLOW_PX = 8;

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

function graphBoundsFromNodes(nodes: readonly Node[]): FlowRect | null {
  if (nodes.length === 0) return null;
  try {
    const b = getNodesBounds(nodes as Node[]);
    if (!b || !Number.isFinite(b.width) || !Number.isFinite(b.height)) return null;
    if (b.width < 1 && b.height < 1) return null;
    return {
      minX: b.x,
      minY: b.y,
      maxX: b.x + b.width,
      maxY: b.y + b.height,
    };
  } catch {
    return null;
  }
}

/**
 * True when the graph bounding box is not fully inside the visible viewport.
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

  const graph = graphBoundsFromNodes(nodes);
  if (!graph) return false;

  return !isFlowRectFullyInside(graph, visible, VISIBILITY_MARGIN_FLOW_PX);
}

/** @deprecated use graphBoundsFromNodes — kept for tests importing graphFlowBounds */
export { graphBoundsFromNodes as graphFlowBounds };
