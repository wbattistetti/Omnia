/**
 * On-screen node bounds for PanZoom visibility (DOM + flow estimates).
 */

import type { Node, Viewport } from 'reactflow';
import {
  resolveFlowPaneElement,
  queryAllFlowNodesInHost,
} from '../utils/flowCanvasDom';
import { paneRectFromElement, flowPointToScreen, type PaneScreenRect } from '../utils/flowScreenProjection';
import { isFinitePosition } from '../utils/flowPositionGuards';
import { computeNodeFlowRect } from './flowGraphBounds';

export type ScreenBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function flowRectToScreenBounds(
  rect: { minX: number; minY: number; maxX: number; maxY: number },
  viewport: Viewport,
  pane: PaneScreenRect
): ScreenBounds | null {
  const tl = flowPointToScreen(rect.minX, rect.minY, viewport, pane);
  const br = flowPointToScreen(rect.maxX, rect.maxY, viewport, pane);
  if (!tl || !br) return null;
  return {
    minX: Math.min(tl.x, br.x),
    minY: Math.min(tl.y, br.y),
    maxX: Math.max(tl.x, br.x),
    maxY: Math.max(tl.y, br.y),
  };
}

function nodeEstimatedScreenBounds(
  node: Node,
  viewport: Viewport,
  pane: PaneScreenRect
): ScreenBounds | null {
  if (!isFinitePosition(node.position)) return null;
  return flowRectToScreenBounds(computeNodeFlowRect(node), viewport, pane);
}

function isBoundsPartiallyOutside(
  b: ScreenBounds,
  pane: PaneScreenRect,
  marginPx: number
): boolean {
  const left = pane.left + marginPx;
  const top = pane.top + marginPx;
  const right = pane.left + pane.width - marginPx;
  const bottom = pane.top + pane.height - marginPx;
  return b.minX < left || b.maxX > right || b.minY < top || b.maxY > bottom;
}

function isBoundsFullyInside(
  b: ScreenBounds,
  pane: PaneScreenRect,
  marginPx: number
): boolean {
  const left = pane.left + marginPx;
  const top = pane.top + marginPx;
  const right = pane.left + pane.width - marginPx;
  const bottom = pane.top + pane.height - marginPx;
  return b.minX >= left && b.maxX <= right && b.minY >= top && b.maxY <= bottom;
}

/** Measured `.react-flow__node` boxes vs the RF canvas root (debug / legacy). */
export function hasAnyNodeDomPartiallyOutsidePane(
  host: HTMLElement | null,
  marginPx = 4,
  nodeIds?: ReadonlySet<string>
): boolean {
  if (!host) return false;
  const paneEl = resolveFlowPaneElement(host);
  const pane = paneRectFromElement(paneEl);
  if (!pane) return false;

  const nodeEls = queryAllFlowNodesInHost(host);
  if (nodeEls.length === 0) return false;

  for (const el of nodeEls) {
    const id = el.getAttribute('data-id')?.trim();
    if (nodeIds && id && !nodeIds.has(id)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) continue;
    const b: ScreenBounds = { minX: r.left, minY: r.top, maxX: r.right, maxY: r.bottom };
    if (isBoundsPartiallyOutside(b, pane, marginPx)) return true;
  }
  return false;
}

/** Flow-estimated footprints (row-aware height, measured width when present). */
export function hasAnyNodeEstimatedPartiallyOutsidePane(
  nodes: readonly Node[],
  viewport: Viewport,
  pane: PaneScreenRect,
  marginPx = 4
): boolean {
  for (const node of nodes) {
    const b = nodeEstimatedScreenBounds(node, viewport, pane);
    if (!b) continue;
    if (isBoundsPartiallyOutside(b, pane, marginPx)) return true;
  }
  return false;
}

/** True when every node fits inside the pane with a generous inset (hide hysteresis). */
export function areAllNodesEstimatedFullyInsidePane(
  nodes: readonly Node[],
  viewport: Viewport,
  pane: PaneScreenRect,
  marginPx = 24
): boolean {
  if (nodes.length === 0) return true;
  for (const node of nodes) {
    const b = nodeEstimatedScreenBounds(node, viewport, pane);
    if (!b) return false;
    if (!isBoundsFullyInside(b, pane, marginPx)) return false;
  }
  return true;
}

export function areAllNodesDomFullyInsidePane(
  host: HTMLElement | null,
  marginPx = 24,
  nodeIds?: ReadonlySet<string>
): boolean {
  if (!host) return true;
  const paneEl = resolveFlowPaneElement(host);
  const pane = paneRectFromElement(paneEl);
  if (!pane) return false;

  const nodeEls = queryAllFlowNodesInHost(host);
  if (nodeEls.length === 0) return true;

  for (const el of nodeEls) {
    const id = el.getAttribute('data-id')?.trim();
    if (nodeIds && id && !nodeIds.has(id)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) continue;
    const b: ScreenBounds = { minX: r.left, minY: r.top, maxX: r.right, maxY: r.bottom };
    if (!isBoundsFullyInside(b, pane, marginPx)) return false;
  }
  return true;
}
