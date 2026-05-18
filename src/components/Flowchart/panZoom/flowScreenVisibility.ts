/**
 * Detects nodes that extend outside the on-screen React Flow pane (pixel space).
 */

import type { Node, Viewport } from 'reactflow';
import type { PaneScreenRect } from '../utils/flowScreenProjection';
import {
  hasAnyNodeEstimatedPartiallyOutsidePane,
  areAllNodesEstimatedFullyInsidePane,
} from './flowNodeScreenBounds';

/** True if any node footprint extends outside the pane's screen rectangle. */
export function hasAnyNodeOutsideScreenPane(
  nodes: readonly Node[],
  viewport: Viewport,
  pane: PaneScreenRect,
  marginPx = 4
): boolean {
  return hasAnyNodeEstimatedPartiallyOutsidePane(nodes, viewport, pane, marginPx);
}

export { areAllNodesEstimatedFullyInsidePane };
