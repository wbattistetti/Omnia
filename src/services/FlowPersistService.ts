import type { Node } from 'reactflow';
import type { FlowNode } from '../components/Flowchart/types/flowTypes';

let pendingPayload: { pid: string; flowId: string; nodes: Node<FlowNode>[]; edges: any[] } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Legacy debounce slot for graph edits. Flow persistence is atomic via FlowDocument
 * (ProjectSaveOrchestrator / saveFlow); partial PUTs are not supported.
 * flushFlowPersist is still invoked before orchestrated saves to clear any pending timer.
 */
export function queueFlowPersist(
  pid: string,
  flowId: string,
  nodes: Node<FlowNode>[],
  edges: any[],
  delayMs: number = 120
) {
  pendingPayload = { pid, flowId, nodes, edges };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    pendingPayload = null;
    timer = null;
  }, Math.max(0, delayMs | 0));
}

/**
 * Clears debounced state. Does not call the network — full flow state is saved as FlowDocument elsewhere.
 */
export function flushFlowPersist(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  pendingPayload = null;
  return Promise.resolve();
}
