/**
 * Bounding box for Omnia flow canvas native scroll (overflow:auto wrapper).
 */

import type { Node } from 'reactflow';

export type FlowCanvasContentBounds = {
  width: number;
  height: number;
  viewportX: number;
  viewportY: number;
};

const DEFAULT_PAD = 200;
const DEFAULT_MIN_WIDTH = 1200;
const DEFAULT_MIN_HEIGHT = 800;
const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_MIN_HEIGHT = 40;
const ROW_LINE_HEIGHT = 24;
const NODE_CHROME = 40;

export type ComputeFlowCanvasContentBoundsOptions = {
  padding?: number;
  minWidth?: number;
  minHeight?: number;
  nodeWidth?: number;
};

/**
 * Returns scrollable content size and React Flow viewport offset so all nodes fit with padding.
 */
export function computeFlowCanvasContentBounds(
  nodes: readonly Node[],
  options?: ComputeFlowCanvasContentBoundsOptions
): FlowCanvasContentBounds {
  const pad = options?.padding ?? DEFAULT_PAD;
  const minWidth = options?.minWidth ?? DEFAULT_MIN_WIDTH;
  const minHeight = options?.minHeight ?? DEFAULT_MIN_HEIGHT;
  const nodeWidth = options?.nodeWidth ?? DEFAULT_NODE_WIDTH;

  if (nodes.length === 0) {
    return {
      width: minWidth,
      height: minHeight,
      viewportX: pad,
      viewportY: pad,
    };
  }

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxX = Math.max(...nodes.map((n) => n.position.x + nodeWidth));
  const maxY = Math.max(
    ...nodes.map((n) => {
      const rows = (n.data as { rows?: unknown[] } | undefined)?.rows;
      const rowCount = Array.isArray(rows) ? rows.length : 0;
      return n.position.y + DEFAULT_NODE_MIN_HEIGHT + rowCount * ROW_LINE_HEIGHT + NODE_CHROME;
    })
  );

  const spanW = Math.max(0, maxX - minX);
  const spanH = Math.max(0, maxY - minY);

  return {
    width: Math.max(minWidth, spanW + pad * 2),
    height: Math.max(minHeight, spanH + pad * 2),
    viewportX: pad - minX,
    viewportY: pad - minY,
  };
}
