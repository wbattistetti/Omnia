/**
 * PanZoom visibility for Omnia flow canvas (native overflow scroll + stable RF viewport).
 */

import type { Node, ReactFlowInstance } from 'reactflow';
import { computeNodeFlowRect, hasAnyNodeOutsideFlowRect, type FlowRect } from './flowGraphBounds';

const OVERFLOW_EPS = 4;

/** True when scroll content exceeds the visible host area. */
export function isNativeScrollOverflow(host: HTMLElement): boolean {
  return (
    host.scrollWidth > host.clientWidth + OVERFLOW_EPS ||
    host.scrollHeight > host.clientHeight + OVERFLOW_EPS
  );
}

/**
 * Visible flow rectangle from native scroll position and React Flow viewport (zoom fixed at 1).
 */
export function visibleFlowRectFromNativeScroll(
  host: HTMLElement,
  viewport: { x: number; y: number; zoom: number }
): FlowRect {
  const zoom = viewport.zoom || 1;
  const minX = (host.scrollLeft - viewport.x) / zoom;
  const minY = (host.scrollTop - viewport.y) / zoom;
  const maxX = (host.scrollLeft + host.clientWidth - viewport.x) / zoom;
  const maxY = (host.scrollTop + host.clientHeight - viewport.y) / zoom;
  return {
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
  };
}

/** True if any node extends outside the host's visible scroll area (flow coords). */
export function hasAnyNodeOutsideNativeScroll(
  nodes: readonly Node[],
  host: HTMLElement,
  viewport: { x: number; y: number; zoom: number }
): boolean {
  if (nodes.length === 0) return false;
  const visible = visibleFlowRectFromNativeScroll(host, viewport);
  return hasAnyNodeOutsideFlowRect(nodes, visible);
}

/** Screen-space check: any node corner outside the host client rect. */
export function hasAnyNodeOutsideHostScreen(
  nodes: readonly Node[],
  host: HTMLElement,
  flowToScreenPosition: ReactFlowInstance['flowToScreenPosition']
): boolean {
  if (nodes.length === 0) return false;
  const hostRect = host.getBoundingClientRect();
  const rfRoot = host.querySelector('.react-flow') as HTMLElement | null;
  if (!rfRoot) return isNativeScrollOverflow(host);

  const rfRect = rfRoot.getBoundingClientRect();

  return nodes.some((n) => {
    const r = computeNodeFlowRect(n);
    const corners = [
      { x: r.minX, y: r.minY },
      { x: r.maxX, y: r.minY },
      { x: r.minX, y: r.maxY },
      { x: r.maxX, y: r.maxY },
    ];
    return corners.some((c) => {
      const p = flowToScreenPosition(c);
      const sx = rfRect.left + p.x;
      const sy = rfRect.top + p.y;
      return (
        sx < hostRect.left - OVERFLOW_EPS ||
        sx > hostRect.right + OVERFLOW_EPS ||
        sy < hostRect.top - OVERFLOW_EPS ||
        sy > hostRect.bottom + OVERFLOW_EPS
      );
    });
  });
}

/** Whether the Omnia minimap should be shown. */
export function isOmniaFlowPanZoomNeeded(
  nodes: readonly Node[],
  host: HTMLElement | null,
  viewport: { x: number; y: number; zoom: number },
  flowToScreenPosition: ReactFlowInstance['flowToScreenPosition'] | undefined
): boolean {
  if (!host || nodes.length === 0) return false;
  if (isNativeScrollOverflow(host)) return true;
  if (flowToScreenPosition && hasAnyNodeOutsideHostScreen(nodes, host, flowToScreenPosition)) {
    return true;
  }
  return hasAnyNodeOutsideNativeScroll(nodes, host, viewport);
}
