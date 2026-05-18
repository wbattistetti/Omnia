/**
 * Suppress duplicate NODE_LAYOUT_SETTLED emissions (same node size).
 */

const SIZE_EPSILON_PX = 2;

const lastEmittedByKey = new Map<string, { width: number; height: number }>();

function key(flowId: string, nodeId: string): string {
  return `${String(flowId || 'main').trim()}|${String(nodeId || '').trim()}`;
}

let layoutMeasureQuietUntil = 0;

/** Briefly pause layout emits after task editor opens (DOM churn). */
export function extendFlowLayoutMeasureQuietWindow(ms = 2500): void {
  layoutMeasureQuietUntil = Math.max(layoutMeasureQuietUntil, Date.now() + ms);
}

export function isFlowLayoutMeasureQuiet(): boolean {
  return Date.now() < layoutMeasureQuietUntil;
}

export function shouldSkipDuplicateLayoutEmit(
  flowId: string,
  nodeId: string,
  width: number,
  height: number
): boolean {
  if (isFlowLayoutMeasureQuiet()) return true;
  const w = Math.round(width);
  const h = Math.round(height);
  if (w < 1 || h < 1) return true;
  const k = key(flowId, nodeId);
  const prev = lastEmittedByKey.get(k);
  if (
    prev &&
    Math.abs(prev.width - w) <= SIZE_EPSILON_PX &&
    Math.abs(prev.height - h) <= SIZE_EPSILON_PX
  ) {
    return true;
  }
  lastEmittedByKey.set(k, { width: w, height: h });
  return false;
}

export function clearLayoutEmitDedupe(flowId?: string): void {
  if (!flowId) {
    lastEmittedByKey.clear();
    return;
  }
  const prefix = `${String(flowId).trim()}|`;
  for (const k of lastEmittedByKey.keys()) {
    if (k.startsWith(prefix)) lastEmittedByKey.delete(k);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('taskEditor:open', () => extendFlowLayoutMeasureQuietWindow());
}
