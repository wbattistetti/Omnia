/**
 * After canvas resize, pan (keep zoom) so the graph bounding box stays in view.
 */

import { getNodesBounds, type Node, type ReactFlowInstance } from 'reactflow';
import {
  isFlowRectFullyInside,
  visibleFlowRectFromViewportStore,
  type FlowRect,
} from '../panZoom/flowGraphBounds';

const MARGIN_PX = 24;

function graphBounds(nodes: readonly Node[]): FlowRect | null {
  if (nodes.length === 0) return null;
  try {
    const b = getNodesBounds(nodes as Node[]);
    if (!b || !Number.isFinite(b.width) || !Number.isFinite(b.height)) return null;
    return { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height };
  } catch {
    return null;
  }
}

/**
 * Pans the viewport (same zoom) to center the graph if it is outside the visible pane.
 */
export function keepFlowGraphInView(
  instance: Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>,
  nodes: readonly Node[],
  paneWidth: number,
  paneHeight: number
): boolean {
  if (nodes.length === 0 || paneWidth < 2 || paneHeight < 2) return false;

  const graph = graphBounds(nodes);
  if (!graph) return false;

  const vp = instance.getViewport();
  if (!(vp.zoom > 0 && Number.isFinite(vp.zoom))) return false;

  const visible = visibleFlowRectFromViewportStore(vp, paneWidth, paneHeight);
  if (!visible) return false;
  if (isFlowRectFullyInside(graph, visible, MARGIN_PX)) return false;

  const cx = (graph.minX + graph.maxX) / 2;
  const cy = (graph.minY + graph.maxY) / 2;
  const x = paneWidth / 2 - cx * vp.zoom;
  const y = paneHeight / 2 - cy * vp.zoom;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  instance.setViewport({ x, y, zoom: vp.zoom }, { duration: 0 });
  return true;
}
