/**
 * Semantic canvas events — only stable commits cross the FlowStore boundary.
 */

export const FLOW_CANVAS_SEMANTIC_EVENT = 'omnia:flowCanvas:semantic';

export type ViewportPayload = { x: number; y: number; zoom: number };

export type NodePositionUpdate = {
  nodeId: string;
  position: { x: number; y: number };
};

export type FlowCanvasSemanticEvent =
  | { type: 'GRAPH_HYDRATED'; flowId: string; fingerprint: string }
  | { type: 'NODE_LAYOUT_SETTLED'; flowId: string; nodeId: string; width: number; height: number }
  | { type: 'NODE_POSITION_COMMITTED'; flowId: string; updates: NodePositionUpdate[] }
  | { type: 'VIEWPORT_SETTLED'; flowId: string; viewport: ViewportPayload }
  | { type: 'VIEWPORT_INITIAL_FIT'; flowId: string; viewport: ViewportPayload }
  | { type: 'CANVAS_LAYOUT_SETTLED'; flowId: string; width: number; height: number };

export function emitFlowCanvasSemantic(event: FlowCanvasSemanticEvent): void {
  if (typeof window === 'undefined') return;
  // Handlers log semantic events once (avoid duplicate emit + subscriber noise).
  window.dispatchEvent(
    new CustomEvent(FLOW_CANVAS_SEMANTIC_EVENT, { detail: event })
  );
}

export function subscribeFlowCanvasSemantic(
  handler: (event: FlowCanvasSemanticEvent) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<FlowCanvasSemanticEvent>).detail;
    if (detail?.type) handler(detail);
  };
  window.addEventListener(FLOW_CANVAS_SEMANTIC_EVENT, listener);
  return () => window.removeEventListener(FLOW_CANVAS_SEMANTIC_EVENT, listener);
}

export function emitViewportSettled(flowId: string, viewport: ViewportPayload): void {
  emitFlowCanvasSemantic({ type: 'VIEWPORT_SETTLED', flowId, viewport });
}

export function emitNodePositionCommitted(
  flowId: string,
  updates: NodePositionUpdate[]
): void {
  if (updates.length === 0) return;
  emitFlowCanvasSemantic({ type: 'NODE_POSITION_COMMITTED', flowId, updates });
}

export function emitNodeLayoutSettled(
  flowId: string,
  nodeId: string,
  width: number,
  height: number
): void {
  emitFlowCanvasSemantic({ type: 'NODE_LAYOUT_SETTLED', flowId, nodeId, width, height });
}

export function emitGraphHydrated(flowId: string, fingerprint: string): void {
  emitFlowCanvasSemantic({ type: 'GRAPH_HYDRATED', flowId, fingerprint });
}

export function emitViewportInitialFit(flowId: string, viewport: ViewportPayload): void {
  emitFlowCanvasSemantic({ type: 'VIEWPORT_INITIAL_FIT', flowId, viewport });
}

export function emitCanvasLayoutSettled(flowId: string, width: number, height: number): void {
  emitFlowCanvasSemantic({ type: 'CANVAS_LAYOUT_SETTLED', flowId, width, height });
}
