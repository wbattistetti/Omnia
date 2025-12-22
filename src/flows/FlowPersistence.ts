import type { FlowId } from './FlowTypes';
import type { Node } from 'reactflow';
import type { FlowNode, EdgeData } from '../components/Flowchart/types/flowTypes';
import { transformNodesToSimplified, transformEdgesToSimplified, transformNodesToReactFlow, transformEdgesToReactFlow } from './flowTransformers';

export async function listFlows(projectId: string): Promise<{ id: FlowId; updatedAt?: string }[]> {
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
export async function loadFlow(projectId: string, flowId: FlowId): Promise<{ nodes: Node<FlowNode>[]; edges: any[] }> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}`;
  // RIMOSSO: console.log che causava loop infinito
  const res = await fetch(url);
  if (!res.ok) throw new Error('loadFlow_failed');
  const json = await res.json();

  // Database returns simplified structure: { id, label, rows, ... }
  const simplifiedNodes = Array.isArray(json?.nodes) ? json.nodes : [];
  const simplifiedEdges = Array.isArray(json?.edges) ? json.edges : [];

  // Transform to ReactFlow format: { id, data: { label, rows, ... } }
  const nodes = transformNodesToReactFlow(simplifiedNodes);
  const edges = transformEdgesToReactFlow(simplifiedEdges);

  // RIMOSSO: console.log che causava loop infinito
  return { nodes, edges };
}

/**
 * Save flow to database, transforming ReactFlow format to simplified structure
 * Receives: Node<FlowNode>[] with data wrapper (ReactFlow format)
 * Saves: { id, label, rows, ... } (simplified)
 */
export async function saveFlow(projectId: string, flowId: FlowId, nodes: Node<FlowNode>[], edges: any[]): Promise<void> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}`;

  // Transform from ReactFlow format to simplified structure
  const simplifiedNodes = transformNodesToSimplified(nodes);
  const simplifiedEdges = transformEdgesToSimplified(edges);

  // RIMOSSO: console.log che causava loop infinito
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes: simplifiedNodes, edges: simplifiedEdges })
  });
  if (!res.ok) throw new Error('saveFlow_failed');
  // RIMOSSO: console.log che causava loop infinito
}


