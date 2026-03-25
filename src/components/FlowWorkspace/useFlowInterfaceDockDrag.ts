/**
 * Pointer-drag from the Interface panel tab or title bar: release near a screen edge
 * commits dock position (nearest edge). Exposes live preview region while dragging.
 */

import { useCallback, useRef, useState } from 'react';
import type { FlowInterfaceDockRegion } from './flowInterfaceDockStorage';

const MOVE_THRESHOLD_PX = 14;

/**
 * Chooses which edge is closest for dock commit / preview.
 * When `flowBounds` is set (flow canvas rect from getBoundingClientRect), uses that inset; otherwise viewport.
 */
export function nearestDockRegionForPoint(
  clientX: number,
  clientY: number,
  flowBounds?: DOMRect | null
): FlowInterfaceDockRegion {
  if (flowBounds && flowBounds.width > 1 && flowBounds.height > 1) {
    const dTop = clientY - flowBounds.top;
    const dBot = flowBounds.bottom - clientY;
    const dLeft = clientX - flowBounds.left;
    const dRight = flowBounds.right - clientX;
    const m = Math.min(dTop, dBot, dLeft, dRight);
    if (m === dTop) return 'top';
    if (m === dBot) return 'bottom';
    if (m === dLeft) return 'left';
    return 'right';
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dTop = clientY;
  const dBot = h - clientY;
  const dLeft = clientX;
  const dRight = w - clientX;
  const m = Math.min(dTop, dBot, dLeft, dRight);
  if (m === dTop) return 'top';
  if (m === dBot) return 'bottom';
  if (m === dLeft) return 'left';
  return 'right';
}

export function useFlowInterfaceDockDrag(
  onCommit: (region: FlowInterfaceDockRegion) => void,
  getFlowBounds?: () => DOMRect | null
) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const activeRef = useRef(false);
  const [dockDragPreview, setDockDragPreview] = useState<FlowInterfaceDockRegion | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    startRef.current = { x: e.clientX, y: e.clientY };
    activeRef.current = false;
    setDockDragPreview(null);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (dx * dx + dy * dy >= MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
      activeRef.current = true;
      const bounds = getFlowBounds?.() ?? null;
      setDockDragPreview(nearestDockRegionForPoint(e.clientX, e.clientY, bounds));
    }
  }, [getFlowBounds]);

  const end = useCallback(
    (e: React.PointerEvent) => {
      const s = startRef.current;
      startRef.current = null;
      setDockDragPreview(null);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!s) return;
      if (!activeRef.current) return;
      activeRef.current = false;
      const bounds = getFlowBounds?.() ?? null;
      onCommit(nearestDockRegionForPoint(e.clientX, e.clientY, bounds));
    },
    [onCommit, getFlowBounds]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      end(e);
    },
    [end]
  );

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    startRef.current = null;
    activeRef.current = false;
    setDockDragPreview(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };

  return {
    dockDragPreview,
    dockDragHandlers: handlers,
  };
}
