import type { FlowId } from './FlowTypes';

export async function listFlows(projectId: string): Promise<{ id: FlowId; updatedAt?: string }[]> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/flows`;
  try { console.log('[Flow][list][req]', { projectId, url }); } catch {}
  const res = await fetch(url);
  if (!res.ok) throw new Error('listFlows_failed');
  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : [];
  try { console.log('[Flow][list][res]', { projectId, count: items.length }); } catch {}
  return items;
}

export async function loadFlow(projectId: string, flowId: FlowId): Promise<{ nodes: any[]; edges: any[] }> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}`;
  try { console.log('[Flow][load][req]', { projectId, flowId, url }); } catch {}
  const res = await fetch(url);
  if (!res.ok) throw new Error('loadFlow_failed');
  const json = await res.json();
  const nodes = Array.isArray(json?.nodes) ? json.nodes : [];
  const edges = Array.isArray(json?.edges) ? json.edges : [];
  try { console.log('[Flow][load][res]', { projectId, flowId, nodes: nodes.length, edges: edges.length }); } catch {}
  return { nodes, edges };
}

export async function saveFlow(projectId: string, flowId: FlowId, nodes: any[], edges: any[]): Promise<void> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/flow?flowId=${encodeURIComponent(flowId)}`;
  try { console.log('[Flow][save][req]', { projectId, flowId, nodes: nodes.length, edges: edges.length, url }); } catch {}
  const res = await fetch(url , {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes, edges })
  });
  if (!res.ok) throw new Error('saveFlow_failed');
  try { console.log('[Flow][save][ok]', { projectId, flowId }); } catch {}
}


