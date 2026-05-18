import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { ReactFlowInstance } from 'reactflow';
import { queryWithinFlowCanvasHost } from '../utils/flowCanvasDom';

/**
 * Flow Editor viewport: Ctrl+wheel zoom, scroll-to-node via RF setViewport/setCenter.
 */
export function useFlowViewport(
  reactFlowInstance: ReactFlowInstance | null,
  canvasHostRef?: RefObject<HTMLElement | null>
) {
  const savedViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);

  const getFlowPane = useCallback((): HTMLElement | null => {
    const host = canvasHostRef?.current ?? null;
    return queryWithinFlowCanvasHost(host, '.react-flow__pane');
  }, [canvasHostRef]);

  const getFlowRootRect = useCallback((): DOMRect | null => {
    const host = canvasHostRef?.current ?? null;
    const root = queryWithinFlowCanvasHost(host, '.react-flow');
    return root?.getBoundingClientRect() ?? null;
  }, [canvasHostRef]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!reactFlowInstance) return;
      if (!e.ctrlKey) return;

      const vp = reactFlowInstance.getViewport();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.15, Math.min(4, vp.zoom * factor));

      const rect = getFlowRootRect();
      const screenX = e.clientX - (rect ? rect.left : 0);
      const screenY = e.clientY - (rect ? rect.top : 0);
      const flowX = (screenX - vp.x) / vp.zoom;
      const flowY = (screenY - vp.y) / vp.zoom;
      const newX = screenX - flowX * newZoom;
      const newY = screenY - flowY * newZoom;

      reactFlowInstance.setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 0 });
    },
    [reactFlowInstance, getFlowRootRect]
  );

  const scrollToNode = useCallback(
    (nodeId?: string, clickPosition?: { x: number; y: number }) => {
      if (!reactFlowInstance) return;

      try {
        savedViewportRef.current = reactFlowInstance.getViewport();

        if (clickPosition && typeof clickPosition.x === 'number' && typeof clickPosition.y === 'number') {
          const flowPosition = reactFlowInstance.screenToFlowPosition({
            x: clickPosition.x,
            y: clickPosition.y,
          });
          const pane = getFlowPane();
          if (!pane) return;
          const viewportWidth = pane.clientWidth;
          reactFlowInstance.setViewport(
            {
              x: -flowPosition.x + viewportWidth / 2,
              y: -flowPosition.y + 20,
              zoom: savedViewportRef.current.zoom,
            },
            { duration: 300 }
          );
          return;
        }

        if (nodeId) {
          const node = reactFlowInstance.getNode(nodeId);
          if (!node?.position) return;
          const pane = getFlowPane();
          if (!pane) return;
          const nodeW = Number(node.width ?? 280) || 280;
          reactFlowInstance.setViewport(
            {
              x: -node.position.x + pane.clientWidth / 2 - nodeW / 2,
              y: -node.position.y + 20,
              zoom: savedViewportRef.current.zoom,
            },
            { duration: 300 }
          );
        }
      } catch {
        /* noop */
      }
    },
    [reactFlowInstance, getFlowPane]
  );

  const restoreViewport = useCallback(() => {
    if (savedViewportRef.current && reactFlowInstance) {
      try {
        reactFlowInstance.setViewport(savedViewportRef.current, { duration: 300 });
        savedViewportRef.current = null;
      } catch {
        /* noop */
      }
    }
  }, [reactFlowInstance]);

  useEffect(() => {
    if (!reactFlowInstance) return;

    const handleScrollToNode = (e: Event) => {
      const ce = e as CustomEvent<{ nodeId?: string; clickPosition?: { x: number; y: number } }>;
      const nodeId = ce.detail?.nodeId;
      const clickPosition = ce.detail?.clickPosition;
      if (!nodeId && !clickPosition) return;
      scrollToNode(nodeId, clickPosition);
    };

    const handleRestoreViewport = () => restoreViewport();

    document.addEventListener('flowchart:scrollToNode', handleScrollToNode);
    document.addEventListener('flowchart:restoreViewport', handleRestoreViewport);

    return () => {
      document.removeEventListener('flowchart:scrollToNode', handleScrollToNode);
      document.removeEventListener('flowchart:restoreViewport', handleRestoreViewport);
    };
  }, [reactFlowInstance, scrollToNode, restoreViewport]);

  return {
    handleWheel,
    scrollToNode,
    restoreViewport,
  };
}
