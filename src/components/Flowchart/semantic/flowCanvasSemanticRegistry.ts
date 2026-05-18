/**
 * One store-facing semantic handler per flowId (avoids duplicate commits from StrictMode / dual mount).
 */

import type { FlowCanvasSemanticEvent } from './flowCanvasSemanticEvents';

const storeHandlerByFlowId = new Map<string, (event: FlowCanvasSemanticEvent) => void>();

/** Register the sole bridge that may commit positions/layout to FlowStore for this flow. */
export function registerFlowCanvasStoreSemanticHandler(
  flowId: string,
  handler: (event: FlowCanvasSemanticEvent) => void
): () => void {
  const id = String(flowId || 'main').trim();
  storeHandlerByFlowId.set(id, handler);
  return () => {
    if (storeHandlerByFlowId.get(id) === handler) {
      storeHandlerByFlowId.delete(id);
    }
  };
}

/** Deliver store commits to the active bridge only (no window fan-out). */
export function dispatchFlowCanvasStoreSemantic(event: FlowCanvasSemanticEvent): void {
  const id = String(event.flowId || 'main').trim();
  storeHandlerByFlowId.get(id)?.(event);
}

export function clearFlowCanvasStoreSemanticHandlers(flowId?: string): void {
  if (flowId) {
    storeHandlerByFlowId.delete(String(flowId).trim());
    return;
  }
  storeHandlerByFlowId.clear();
}
