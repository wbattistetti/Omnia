import type { FlowId } from './FlowTypes';

export async function listFlows(projectId: string): Promise<{ id: FlowId; updatedAt?: string }[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/flows`);
  if (!res.ok) throw new Error('listFlows_failed');
  const json = await res.json();
  return Array.isArray(json?.items) ? json.items : [];
}

export async function loadFlow(projectId: string, flowId: FlowId): Promise<{ nodes: any[]; edges: any[] }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}`);
  if (!res.ok) throw new Error('loadFlow_failed');
  const json = await res.json();
  return { nodes: Array.isArray(json?.nodes) ? json.nodes : [], edges: Array.isArray(json?.edges) ? json.edges : [] };
}

export async function saveFlow(projectId: string, flowId: FlowId, nodes: any[], edges: any[]): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}` , {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes, edges })
  });
  if (!res.ok) throw new Error('saveFlow_failed');
}


