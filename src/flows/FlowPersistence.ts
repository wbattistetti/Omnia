import type { FlowId } from './FlowTypes';
import type { FlowVariableDefinition } from './flowVariableTypes';
import type { Node } from 'reactflow';
import type { FlowNode, EdgeData } from '../components/Flowchart/types/flowTypes';
import { transformNodesToSimplified, transformEdgesToSimplified, transformNodesToReactFlow, transformEdgesToReactFlow } from './flowTransformers';
import { logFlowSaveDebug } from '../utils/flowSaveDebug';

export async function listFlows(projectId: string): Promise<{ id: FlowId; updatedAt?: string }[]> {
  if (!projectId || String(projectId).trim() === '') {
    return [];
  }
  const url = `/api/projects/${encodeURIComponent(projectId)}/flows`;
  // RIMOSSO: console.log che causava loop infinito
  const res = await fetch(url);
  if (!res.ok) throw new Error('listFlows_failed');
  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : [];
  // RIMOSSO: console.log che causava loop infinito
  return items;
}

/**
 * Load flow from database and transform simplified structure to ReactFlow format
 * Database stores: { id, label, rows, ... } (simplified)
 * Returns: Node<FlowNode>[] with data wrapper (ReactFlow format)
 */
export type FlowLoadResult = {
  nodes: Node<FlowNode>[];
  edges: any[];
  meta?: { variables?: FlowVariableDefinition[] };
};

export async function loadFlow(projectId: string, flowId: FlowId): Promise<FlowLoadResult> {
  if (!projectId || String(projectId).trim() === '') {
    return { nodes: [], edges: [] };
  }
  const url = `/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}`;
  // Log rimosso: non essenziale per flusso motore

  const res = await fetch(url);
  if (!res.ok) throw new Error('loadFlow_failed');
  const json = await res.json();

  // Database returns simplified structure: { id, label, rows, ... }
  const simplifiedNodes = Array.isArray(json?.nodes) ? json.nodes : [];
  const simplifiedEdges = Array.isArray(json?.edges) ? json.edges : [];
  const meta =
    json?.meta && typeof json.meta === 'object'
      ? (json.meta as { variables?: FlowVariableDefinition[] })
      : undefined;

  logFlowSaveDebug('loadFlow: response from API (simplified counts before ReactFlow transform)', {
    projectId,
    flowId,
    simplifiedNodeCount: simplifiedNodes.length,
    simplifiedEdgeCount: simplifiedEdges.length,
    hasMeta: meta !== undefined,
  });

  // Transform to ReactFlow format: { id, data: { label, rows, ... } }
  const nodes = transformNodesToReactFlow(simplifiedNodes);
  const edges = transformEdgesToReactFlow(simplifiedEdges);

  return { nodes, edges, meta };
}

/**
 * Save flow to database, transforming ReactFlow format to simplified structure
 * Receives: Node<FlowNode>[] with data wrapper (ReactFlow format)
 * Saves: { id, label, rows, ... } (simplified)
 */
export async function saveFlow(
  projectId: string,
  flowId: FlowId,
  nodes: Node<FlowNode>[],
  edges: any[],
  meta?: { variables?: FlowVariableDefinition[] }
): Promise<void> {
  if (!projectId || String(projectId).trim() === '') {
    return;
  }
  const url = `/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}`;

  // Transform from ReactFlow format to simplified structure
  const simplifiedNodes = transformNodesToSimplified(nodes);
  const simplifiedEdges = transformEdgesToSimplified(edges);

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodes: simplifiedNodes,
      edges: simplifiedEdges,
      ...(meta !== undefined ? { meta } : {}),
    }),
  });
  if (!res.ok) throw new Error('saveFlow_failed');

}


