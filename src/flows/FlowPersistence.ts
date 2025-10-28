import type { FlowId } from './FlowTypes';

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

export async function loadFlow(projectId: string, flowId: FlowId): Promise<{ nodes: any[]; edges: any[] }> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}`;
  // RIMOSSO: console.log che causava loop infinito
  const res = await fetch(url);
  if (!res.ok) throw new Error('loadFlow_failed');
  const json = await res.json();
  const nodes = Array.isArray(json?.nodes) ? json.nodes : [];
  const edges = Array.isArray(json?.edges) ? json.edges : [];
  // RIMOSSO: console.log che causava loop infinito
  return { nodes, edges };
}

export async function saveFlow(projectId: string, flowId: FlowId, nodes: any[], edges: any[]): Promise<void> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}`;
  // RIMOSSO: console.log che causava loop infinito
  const res = await fetch(url, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes, edges })
  });
  if (!res.ok) throw new Error('saveFlow_failed');
  // RIMOSSO: console.log che causava loop infinito
}


