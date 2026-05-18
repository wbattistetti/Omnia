/**
 * Defers React Flow mount until the shell has non-zero layout (avoids RF error #004 flicker).
 */

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flowCanvasDiag } from '../utils/flowCanvasDiagnostics';
import {
  isFlowContainerSized,
  measureFlowContainerSize,
} from '../utils/measureFlowContainerSize';

const MAX_RETRIES = 24;

export function useFlowCanvasShellReady(
  flowCanvasId: string,
  shellRef: RefObject<HTMLElement | null>,
  fallbackRef?: RefObject<HTMLElement | null>
): boolean {
  const [ready, setReady] = useState(false);
  const canvasId = String(flowCanvasId || 'main').trim();
  const loggedReadyRef = useRef(false);

  useLayoutEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    let retryFrame = 0;
    loggedReadyRef.current = false;

    const measure = () =>
      measureFlowContainerSize({
        primary: () => shellRef.current,
        fallback: fallbackRef ? () => fallbackRef.current : undefined,
      });

    const tryReady = () => {
      if (cancelled) return;
      const size = measure();
      if (isFlowContainerSized(size)) {
        if (!loggedReadyRef.current) {
          loggedReadyRef.current = true;
          flowCanvasDiag('shell.ready', {
            flowId: canvasId,
            width: size.width,
            height: size.height,
            retries: retryCount,
          });
        }
        setReady(true);
        return;
      }
      if (retryCount === 0) {
        flowCanvasDiag('shell.waiting_for_size', {
          flowId: canvasId,
          width: size.width,
          height: size.height,
        });
      }
      if (retryCount < MAX_RETRIES) {
        retryCount += 1;
        retryFrame = window.requestAnimationFrame(tryReady);
        return;
      }
      flowCanvasDiag('shell.size_timeout', {
        flowId: canvasId,
        width: size.width,
        height: size.height,
        maxRetries: MAX_RETRIES,
        note: 'React Flow may still warn #004; check dock tab / flex parent height',
      });
    };

    setReady(false);
    tryReady();

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            retryCount = 0;
            const size = measure();
            if (isFlowContainerSized(size)) setReady(true);
          })
        : null;

    const observe = (el: HTMLElement | null) => {
      if (el && ro) ro.observe(el);
    };
    observe(shellRef.current);
    if (fallbackRef) observe(fallbackRef.current);

    return () => {
      cancelled = true;
      if (retryFrame) window.cancelAnimationFrame(retryFrame);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when canvas tab changes
  }, [canvasId, shellRef, fallbackRef]);

  return ready;
}
