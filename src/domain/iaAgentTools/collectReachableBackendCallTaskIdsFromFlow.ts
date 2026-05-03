/**
 * Rileva i task Backend Call raggiungibili dall’AI Agent seguendo gli archi uscenti sul canvas del flow.
 * Usato per proporre `convaiBackendToolTaskIds` senza includere backend non collegati o non pronti.
 */

import { taskRepository } from '@services/TaskRepository';
import { TaskType, type Task } from '@types/taskTypes';

export type FlowSliceForBackendDiscovery = {
  nodes: unknown[];
  edges: unknown[];
};

export type ResolveTaskFn = (taskId: string) => Task | null | undefined;

function nodeIdOf(n: unknown): string {
  const rec = n as { id?: string };
  return String(rec?.id ?? '').trim();
}

function rowIdsOnNode(n: unknown): string[] {
  const rec = n as { data?: { rows?: Array<{ id?: string }> } };
  const rows = rec?.data?.rows;
  if (!Array.isArray(rows)) return [];
  const out: string[] = [];
  for (const r of rows) {
    const id = String(r?.id ?? '').trim();
    if (id) out.push(id);
  }
  return out;
}

/**
 * Partendo dal nodo che contiene la riga con `aiAgentTaskId`, percorre solo gli archi **uscenti**
 * (`source` → `target`) e raccoglie gli id dei task di tipo {@link TaskType.BackendCall} presenti
 * sui nodi visitati (incl. il nodo di partenza se applicabile).
 */
export function collectReachableBackendCallTaskIdsFromFlow(
  flow: FlowSliceForBackendDiscovery | null | undefined,
  aiAgentTaskId: string,
  resolveTask: ResolveTaskFn = (id) => taskRepository.getTask(id)
): string[] {
  const agentRowId = String(aiAgentTaskId || '').trim();
  if (!flow || !agentRowId) return [];

  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow.edges) ? flow.edges : [];

  const startNodeIds = new Set<string>();
  for (const n of nodes) {
    const nid = nodeIdOf(n);
    if (!nid) continue;
    const rows = rowIdsOnNode(n);
    if (rows.includes(agentRowId)) {
      startNodeIds.add(nid);
    }
  }
  if (startNodeIds.size === 0) return [];

  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    const er = e as { source?: string; target?: string };
    const s = String(er.source ?? '').trim();
    const t = String(er.target ?? '').trim();
    if (!s || !t) continue;
    if (!adj.has(s)) adj.set(s, new Set());
    adj.get(s)!.add(t);
  }

  const visited = new Set<string>(startNodeIds);
  const queue = [...startNodeIds];
  while (queue.length > 0) {
    const u = queue.pop()!;
    const outs = adj.get(u);
    if (!outs) continue;
    for (const v of outs) {
      if (visited.has(v)) continue;
      visited.add(v);
      queue.push(v);
    }
  }

  const backendIds = new Set<string>();
  for (const n of nodes) {
    const nid = nodeIdOf(n);
    if (!nid || !visited.has(nid)) continue;
    for (const tid of rowIdsOnNode(n)) {
      const task = resolveTask(tid);
      if (task?.type === TaskType.BackendCall) {
        backendIds.add(tid);
      }
    }
  }

  return [...backendIds].sort();
}
