import type { Node } from 'reactflow';
import type { FlowNode, EdgeData } from '../components/Flowchart/types/flowTypes';
import { transformNodesToSimplified, transformEdgesToSimplified } from '../flows/flowTransformers';

let pendingPayload: { pid: string; flowId: string; nodes: Node<FlowNode>[]; edges: any[] } | null = null;
let timer: any = null;

/**
 * Queue flow persistence - transforms ReactFlow nodes to simplified structure before saving
 * Receives: Node<FlowNode>[] with data wrapper (ReactFlow format)
 * Saves: { id, label, rows, ... } (simplified)
 */
export function queueFlowPersist(pid: string, flowId: string, nodes: Node<FlowNode>[], edges: any[], delayMs: number = 120) {
  pendingPayload = { pid, flowId, nodes, edges };
  if (timer) clearTimeout(timer);
  try {
    console.log('[Flow][Persist][queue]', {
      pid,
      flowId,
      nodes: Array.isArray(nodes) ? nodes.length : 0,
      edges: Array.isArray(edges) ? edges.length : 0,
      delayMs
    });
  } catch {}
  timer = setTimeout(async () => {
    const p = pendingPayload;
    pendingPayload = null;
    timer = null;
    if (!p) return;
    try {
      // Transform from ReactFlow format to simplified structure
      const simplifiedNodes = transformNodesToSimplified(p.nodes);
      const simplifiedEdges = transformEdgesToSimplified(p.edges);

      console.log('[Flow][Persist][send]', {
        pid: p.pid,
        flowId: p.flowId,
        nodes: Array.isArray(p.nodes) ? p.nodes.length : 0,
        edges: Array.isArray(p.edges) ? p.edges.length : 0
      });
      await fetch(`/api/projects/${encodeURIComponent(p.pid)}/flow?flowId=${encodeURIComponent(p.flowId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: simplifiedNodes, edges: simplifiedEdges })
      });
      try { console.log('[Flow][Persist][ok]', { pid: p.pid, flowId: p.flowId }); } catch {}
    } catch (e) {
      try { console.warn('[Flow][Persist][error]', e); } catch {}
    }
  }, Math.max(0, delayMs | 0));
}

export function flushFlowPersist() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const p = pendingPayload;
  pendingPayload = null;
  if (!p) return Promise.resolve();
  try {
    console.log('[Flow][Persist][flush]', {
      pid: p.pid,
      flowId: p.flowId,
      nodes: Array.isArray(p.nodes) ? p.nodes.length : 0,
      edges: Array.isArray(p.edges) ? p.edges.length : 0
    });
  } catch {}

  // Transform from ReactFlow format to simplified structure
  const simplifiedNodes = transformNodesToSimplified(p.nodes);
  const simplifiedEdges = transformEdgesToSimplified(p.edges);

  return fetch(`/api/projects/${encodeURIComponent(p.pid)}/flow?flowId=${encodeURIComponent(p.flowId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes: simplifiedNodes, edges: simplifiedEdges })
  }).then(() => { try { console.log('[Flow][Persist][flush-ok]', { pid: p.pid, flowId: p.flowId }); } catch {} })
    .catch((e) => { try { console.warn('[Flow][Persist][flush-error]', e); } catch {} });
}
