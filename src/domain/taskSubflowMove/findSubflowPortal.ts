/**
 * Detects a Subflow task row on a canvas node (portal to a child flow id).
 */

import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';

function resolveSubflowIdFromTask(task: { flowId?: string; parameters?: Array<{ parameterId?: string; value?: unknown }> } | null): string | null {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p) => String(p?.parameterId || '').trim() === 'flowId');
  return String(fromParam?.value || '').trim() || null;
}

export type SubflowPortalInfo = {
  childFlowId: string;
  subflowTaskRowId: string;
  subflowRowLabel: string;
};

/**
 * Returns the first Subflow row on the node that links to a child flow, if any.
 */
export function findFirstSubflowPortalInNode(node: { data?: { rows?: unknown[] } } | null | undefined): SubflowPortalInfo | null {
  const rows = node?.data?.rows;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    const rid = String((row as { id?: string })?.id || '').trim();
    if (!rid) continue;
    const task = taskRepository.getTask(rid);
    if (!task || task.type !== TaskType.Subflow) continue;
    const cf = resolveSubflowIdFromTask(task as any);
    if (cf) {
      return {
        childFlowId: cf,
        subflowTaskRowId: rid,
        subflowRowLabel: String((row as { text?: string })?.text || '').trim(),
      };
    }
  }
  return null;
}
