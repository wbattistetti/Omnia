import { useCallback, useEffect, useRef } from 'react';
import { ReactFlowInstance } from 'reactflow';

/**
 * Hook for managing Flow Editor viewport and zoom operations
 *
 * Centralizes viewport initialization, zoom handling, scroll-to-node,
 * and viewport save/restore functionality.
 *
 * @param reactFlowInstance - React Flow instance from useReactFlow()
 * @returns Object with handleWheel function for zoom handling
 */
export function useFlowViewport(reactFlowInstance: ReactFlowInstance | null) {
  // Save/restore viewport for ConditionEditor scroll
  const savedViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const initializedRef = useRef(false);

  /**
   * Initialize viewport to zoom 1 on first mount
   */
  useEffect(() => {
    if (reactFlowInstance && !initializedRef.current) {
      try {
        (reactFlowInstance as any).setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 });
      } catch {
        // Silent fail
      }
      initializedRef.current = true;
    }
  }, [reactFlowInstance]);

  /**
   * Handles wheel events for zoom (only when CTRL is pressed)
   * Keeps the cursor position fixed during zoom
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!reactFlowInstance) return;
      if (!e.ctrlKey) {
        // Don't zoom without CTRL; don't call preventDefault on passive listeners
        return;
      }

      // Zoom keeping the cursor screen point fixed
      const vp = (reactFlowInstance as any).getViewport
        ? (reactFlowInstance as any).getViewport()
        : { x: 0, y: 0, zoom: 1 };
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.2, Math.min(4, vp.zoom * factor));

      // Convert screen point to flow coordinates before zoom
      const rect = (document.querySelector('.react-flow') as HTMLElement)?.getBoundingClientRect();
      const screenX = e.clientX - (rect ? rect.left : 0);
      const screenY = e.clientY - (rect ? rect.top : 0);
      const flowX = (screenX - vp.x) / vp.zoom;
      const flowY = (screenY - vp.y) / vp.zoom;

      // Compute new pan so the same flow point stays under cursor after zoom
      const newX = screenX - flowX * newZoom;
      const newY = screenY - flowY * newZoom;

      if ((reactFlowInstance as any).setViewport) {
        (reactFlowInstance as any).setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 0 });
      }
    },
    [reactFlowInstance]
  );

  /**
   * Scrolls to a specific node or position
   * Saves current viewport before scrolling
   */
  const scrollToNode = useCallback(
    (nodeId?: string, clickPosition?: { x: number; y: number }) => {
      if (!reactFlowInstance) return;

      try {
        // Save current viewport
        const currentViewport = reactFlowInstance.getViewport();
        savedViewportRef.current = {
          x: currentViewport.x,
          y: currentViewport.y,
          zoom: currentViewport.zoom,
        };
        console.log('[useFlowViewport] Saved viewport', savedViewportRef.current);

        // Get viewport dimensions
        const viewport = reactFlowInstance.getViewport();
        const pane = document.querySelector('.react-flow__pane') as HTMLElement;
        if (!pane) {
          console.warn('[useFlowViewport] ReactFlow pane not found');
          return;
        }

        const paneRect = pane.getBoundingClientRect();
        const viewportWidth = paneRect.width;
        const viewportHeight = paneRect.height;

        let newX: number;
        let newY: number;

        // If we have click position, use it for precise scrolling
        if (clickPosition && typeof clickPosition.x === 'number' && typeof clickPosition.y === 'number') {
          // Convert screen coordinates to flow coordinates
          const flowPosition = reactFlowInstance.screenToFlowPosition({
            x: clickPosition.x,
            y: clickPosition.y,
          });

          console.log('[useFlowViewport] Converted click position to flow coordinates', {
            screen: clickPosition,
            flow: flowPosition,
            viewport,
          });

          // Calculate viewport position to center the click point (with offset from top)
          // We want the click point to be at the top of the viewport (with 20px padding)
          newX = -flowPosition.x + viewportWidth / 2;
          newY = -flowPosition.y + 20; // 20px padding from top
        } else if (nodeId) {
          // Fallback: use node position
          const node = reactFlowInstance.getNode(nodeId);
          console.log('[useFlowViewport] Node found', { nodeId, node, hasPosition: !!node?.position });

          if (!node || !node.position) {
            console.warn('[useFlowViewport] Node not found or has no position', { nodeId, node });
            return;
          }

          // Calculate viewport position to center node at top
          const nodeX = node.position.x;
          const nodeY = node.position.y;
          const nodeWidth = node.width || 280; // Default node width

          newX = -nodeX + viewportWidth / 2 - nodeWidth / 2;
          newY = -nodeY + 20; // 20px padding from top
        } else {
          return;
        }

        console.log('[useFlowViewport] Scrolling to position', {
          nodeId,
          clickPosition,
          viewportSize: { width: viewportWidth, height: viewportHeight },
          newViewport: { x: newX, y: newY, zoom: viewport.zoom },
        });

        // Set viewport with smooth animation
        reactFlowInstance.setViewport({ x: newX, y: newY, zoom: viewport.zoom }, { duration: 300 });
      } catch (err) {
        console.error('[useFlowViewport] Failed to scroll to node', err);
      }
    },
    [reactFlowInstance]
  );

  /**
   * Restores the previously saved viewport
   */
  const restoreViewport = useCallback(() => {
    if (savedViewportRef.current && reactFlowInstance) {
      try {
        reactFlowInstance.setViewport(savedViewportRef.current, { duration: 300 });
        savedViewportRef.current = null;
      } catch (err) {
        console.warn('[useFlowViewport] Failed to restore viewport', err);
      }
    }
  }, [reactFlowInstance]);

  /**
   * Listen for scroll to node events (from ConditionEditor)
   */
  useEffect(() => {
    if (!reactFlowInstance) return;

    const handleScrollToNode = (e: any) => {
      const nodeId = e.detail?.nodeId;
      const clickPosition = e.detail?.clickPosition; // Screen coordinates of the click
      console.log('[useFlowViewport] Scroll to node event received', { nodeId, clickPosition, detail: e.detail });

      if (!nodeId && !clickPosition) {
        console.warn('[useFlowViewport] No nodeId or clickPosition provided in scroll event');
        return;
      }

      scrollToNode(nodeId, clickPosition);
    };

    const handleRestoreViewport = () => {
      restoreViewport();
    };

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
