/**
 * Lists BackendCall row labels from the active flow canvas for AI Agent placeholder insertion.
 */

import type { WorkspaceState } from '../../flows/FlowTypes';
import { taskRepository } from '../../services/TaskRepository';
import { TaskType } from '../../types/taskTypes';

/**
 * Unique non-empty row texts for nodes whose row task type is BackendCall on the active flow.
 */
export function collectBackendRowPathsFromActiveFlow(
  flows: WorkspaceState['flows'],
  activeFlowId: string | undefined
): string[] {
  const paths = new Set<string>();
  const fid = typeof activeFlowId === 'string' ? activeFlowId.trim() : '';
  if (!fid) return [];
  const flow = flows?.[fid];
  const nodes = flow?.nodes;
  if (!Array.isArray(nodes)) return [];

  for (const node of nodes as Array<{ data?: { rows?: Array<{ id: string; text?: string }> } }>) {
    const rows = node.data?.rows;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const task = taskRepository.getTask(row.id);
      if (!task || task.type !== TaskType.BackendCall) continue;
      const label = String(row.text ?? '').trim();
      if (label.length > 0) paths.add(label);
    }
  }

  return [...paths].sort((a, b) => a.localeCompare(b));
}
