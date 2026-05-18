/**
 * Keeps React Flow viewport dimensions in sync when the parent container resizes
 * (dock tab, splitter, workspace tab switch). Prevents partial black canvas glitches.
 */

import React from 'react';
import { useStoreApi } from 'reactflow';
import { flowCanvasDiag } from './utils/flowCanvasDiagnostics';
import {
  isFlowContainerSized,
  measureFlowContainerSize,
} from './utils/measureFlowContainerSize';
import { emitCanvasLayoutSettled } from './semantic/flowCanvasSemanticEvents';

export type ReactFlowContainerResizeProps = {
  flowCanvasId?: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Optional outer host (dock tab root) — used when shell is 0×0 on first paint. */
  fallbackRef?: React.RefObject<HTMLDivElement | null>;
  /** Increment to force dimension sync + viewport repaint (e.g. after node drag). */
  repaintKey?: number;
};

const MAX_SIZE_RETRIES = 24;

export function ReactFlowContainerResize({
  flowCanvasId = 'main',
  containerRef,
  fallbackRef,
  repaintKey = 0,
}: ReactFlowContainerResizeProps): null {
  const storeApi = useStoreApi();
  const canvasId = String(flowCanvasId || 'main').trim();
  const layoutDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySizeRef = React.useRef<() => void>(() => {});

  React.useLayoutEffect(() => {
    const primary = () => containerRef.current;
    const fallback = () => fallbackRef?.current ?? null;

    const measure = () =>
      measureFlowContainerSize({
        primary,
        fallback: fallbackRef ? fallback : undefined,
      });

    let retryCount = 0;
    let retryFrame = 0;

    const applySize = () => {
      const { width, height } = measure();
      if (!isFlowContainerSized({ width, height })) {
        if (retryCount < MAX_SIZE_RETRIES) {
          retryCount += 1;
          retryFrame = window.requestAnimationFrame(applySize);
        } else {
          flowCanvasDiag('resize.gave_up', {
            flowId: canvasId,
            width,
            height,
            maxRetries: MAX_SIZE_RETRIES,
          });
        }
        return;
      }
      retryCount = 0;
      const prev = storeApi.getState();
      const sizeChanged = prev.width !== width || prev.height !== height;
      if (sizeChanged) {
        flowCanvasDiag('resize.apply', { flowId: canvasId, width, height, retries: retryCount });
        storeApi.setState({ width, height });
      }
      if (sizeChanged) {
        if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
        layoutDebounceRef.current = setTimeout(() => {
          layoutDebounceRef.current = null;
          emitCanvasLayoutSettled(canvasId, width, height);
        }, 150);
      }
    };

    applySizeRef.current = applySize;
    applySize();

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            retryCount = 0;
            window.requestAnimationFrame(applySize);
          })
        : null;

    const observe = (el: HTMLElement | null) => {
      if (el && ro) ro.observe(el);
    };
    observe(primary());
    observe(fallback());

    const onWindowResize = () => {
      retryCount = 0;
      window.requestAnimationFrame(applySize);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      if (retryFrame) window.cancelAnimationFrame(retryFrame);
      if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
      ro?.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [containerRef, fallbackRef, storeApi, canvasId]);

  React.useEffect(() => {
    if (!repaintKey) return;
    const frame = window.requestAnimationFrame(() => {
      applySizeRef.current();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [repaintKey]);

  return null;
}
