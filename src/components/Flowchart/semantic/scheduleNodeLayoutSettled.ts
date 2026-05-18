/**
 * Debounced NODE_LAYOUT_SETTLED emission (ResizeObserver ingress filter).
 */

import { emitNodeLayoutSettled } from './flowCanvasSemanticEvents';

const DEBOUNCE_MS = 200;
const SIZE_EPSILON_PX = 2;

type Pending = { width: number; height: number; timer: ReturnType<typeof setTimeout> };

const pendingByKey = new Map<string, Pending>();

function key(flowId: string, nodeId: string): string {
  return `${flowId}|${nodeId}`;
}

/** Schedule layout commit after DOM settles; ignores sub-epsilon churn. */
export function scheduleNodeLayoutSettled(
  flowId: string,
  nodeId: string,
  width: number,
  height: number
): void {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w < 1 || h < 1) return;

  const k = key(flowId, nodeId);
  const prev = pendingByKey.get(k);
  if (prev) {
    if (Math.abs(prev.width - w) <= SIZE_EPSILON_PX && Math.abs(prev.height - h) <= SIZE_EPSILON_PX) {
      return;
    }
    clearTimeout(prev.timer);
  }

  const timer = setTimeout(() => {
    pendingByKey.delete(k);
    emitNodeLayoutSettled(flowId, nodeId, w, h);
  }, DEBOUNCE_MS);

  pendingByKey.set(k, { width: w, height: h, timer });
}

export function cancelNodeLayoutSettled(flowId: string, nodeId: string): void {
  const k = key(flowId, nodeId);
  const prev = pendingByKey.get(k);
  if (prev) clearTimeout(prev.timer);
  pendingByKey.delete(k);
}
