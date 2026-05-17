/**
 * Keeps React Flow viewport dimensions in sync when the parent container resizes
 * (dock tab, splitter, workspace tab switch). Prevents partial black canvas glitches.
 */

import React from 'react';
import { useReactFlow, useStoreApi } from 'reactflow';

export type ReactFlowContainerResizeProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** When graph structure changes, fit view once. */
  layoutKey?: string;
  /** Increment to force dimension sync + viewport repaint (e.g. after node drag). */
  repaintKey?: number;
};

export function ReactFlowContainerResize({
  containerRef,
  layoutKey = '',
  repaintKey = 0,
}: ReactFlowContainerResizeProps): null {
  const storeApi = useStoreApi();
  const { fitView, getViewport, setViewport } = useReactFlow();
  const lastLayoutKeyRef = React.useRef('');

  React.useEffect(() => {
    if (!layoutKey || lastLayoutKeyRef.current === layoutKey) return;
    lastLayoutKeyRef.current = layoutKey;
    const t = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.25, maxZoom: 1.15, duration: 200 });
    });
    return () => window.cancelAnimationFrame(t);
  }, [layoutKey, fitView]);

  const applySizeRef = React.useRef<() => void>(() => {});

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const applySize = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width < 2 || height < 2) return;
      const prev = storeApi.getState();
      if (prev.width === width && prev.height === height) return;
      storeApi.setState({ width, height });
    };

    applySizeRef.current = applySize;
    applySize();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(applySize);
    });
    ro.observe(el);

    const onWindowResize = () => requestAnimationFrame(applySize);
    window.addEventListener('resize', onWindowResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [containerRef, storeApi]);

  React.useEffect(() => {
    if (!repaintKey) return;
    const frame = window.requestAnimationFrame(() => {
      applySizeRef.current();
      try {
        const vp = getViewport();
        setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom }, { duration: 0 });
      } catch {
        /* React Flow not ready */
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [repaintKey, getViewport, setViewport]);

  return null;
}
