/**
 * PanZoom visibility — semantic events only (no per-frame transform / nodes position subscription).
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useStoreApi } from 'reactflow';
import { flowCanvasDiag } from '../utils/flowCanvasDiagnostics';
import { subscribeFlowCanvasSemantic } from '../semantic/flowCanvasSemanticEvents';
import { computeFlowPanZoomNeeded } from './flowPanZoomCompute';

const SETTLE_MS = 120;
const HIDE_HYSTERESIS_MS = 450;

export function useFlowPanZoomNeeded(
  flowCanvasId: string,
  nodes: readonly import('reactflow').Node[],
  viewportHostRef?: RefObject<HTMLElement | null>
): boolean {
  const canvasId = String(flowCanvasId || 'main').trim();
  const storeApi = useStoreApi();
  const [needed, setNeeded] = useState(false);
  const neededRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const readNeeded = useCallback((): boolean => {
    const s = storeApi.getState();
    return computeFlowPanZoomNeeded(nodesRef.current, {
      transform: s.transform,
      width: s.width,
      height: s.height,
    }, viewportHostRef?.current ?? null);
  }, [storeApi, viewportHostRef]);

  const commitNeeded = useCallback(
    (next: boolean, reason: string) => {
      if (neededRef.current === next) return;
      neededRef.current = next;
      setNeeded(next);
      flowCanvasDiag(next ? 'panzoom.show' : 'panzoom.hide', { reason });
    },
    []
  );

  const evaluateNow = useCallback(
    (reason: string) => {
      const next = readNeeded();
      commitNeeded(next, reason);
    },
    [readNeeded, commitNeeded]
  );

  const scheduleEvaluate = useCallback(
    (reason: string) => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        const next = readNeeded();
        if (next) {
          if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
          }
          commitNeeded(true, reason);
        } else if (!hideTimerRef.current) {
          hideTimerRef.current = setTimeout(() => {
            hideTimerRef.current = null;
            if (!readNeeded()) commitNeeded(false, `${reason}_hide`);
          }, HIDE_HYSTERESIS_MS);
        }
      }, SETTLE_MS);
    },
    [readNeeded, commitNeeded]
  );

  useEffect(() => {
    const unsub = subscribeFlowCanvasSemantic((ev) => {
      if (String(ev.flowId).trim() !== canvasId) return;
      switch (ev.type) {
        case 'VIEWPORT_SETTLED':
        case 'VIEWPORT_INITIAL_FIT':
        case 'NODE_POSITION_COMMITTED':
        case 'NODE_LAYOUT_SETTLED':
        case 'GRAPH_HYDRATED':
        case 'CANVAS_LAYOUT_SETTLED':
          scheduleEvaluate(ev.type);
          break;
        default:
          break;
      }
    });

    const onResize = () => scheduleEvaluate('resize');
    window.addEventListener('resize', onResize);

    const t = window.setTimeout(() => evaluateNow('mount'), 400);

    return () => {
      unsub();
      window.clearTimeout(t);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [canvasId, scheduleEvaluate, evaluateNow]);

  return needed;
}
