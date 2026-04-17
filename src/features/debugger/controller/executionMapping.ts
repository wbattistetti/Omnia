/**
 * Maps compiled task ids to flow node ids for debugger highlight (pure helpers).
 */
import type { ExecutionState } from '@components/FlowCompiler/types';

export function buildTaskIdToNodeIdMap(nodes: unknown[], tasks: unknown[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of nodes || []) {
    const node = n as { id?: string; data?: { rows?: Array<{ taskId?: string; id?: string }> } };
    const rows = node?.data?.rows ?? [];
    for (const row of rows) {
      const tid = String(row?.taskId || row?.id || '').trim();
      if (tid) m.set(tid, String(node.id));
    }
  }
  for (const t of tasks || []) {
    const task = t as { id?: string; nodeId?: string };
    const tid = String(task?.id || '').trim();
    const nodeId = task?.nodeId != null ? String(task.nodeId).trim() : '';
    if (tid && nodeId) m.set(tid, nodeId);
  }
  return m;
}

export function executedTaskIdsAsArray(state: ExecutionState): string[] {
  const st = state as unknown as { executedTaskIds?: string[] | Set<string> };
  if (st.executedTaskIds instanceof Set) return Array.from(st.executedTaskIds);
  if (Array.isArray(st.executedTaskIds)) return st.executedTaskIds;
  return [];
}

export function priorPassedNodeIdsForActive(
  state: ExecutionState,
  taskToNode: Map<string, string>,
  activeNodeId: string
): string[] {
  const executed = executedTaskIdsAsArray(state);
  const passed = new Set<string>();
  for (const tid of executed) {
    const nid = taskToNode.get(String(tid));
    if (nid) passed.add(nid);
  }
  return [...passed].filter((id) => id !== activeNodeId);
}
