/**
 * Leaf SEND OpenAPI raggruppati per Backend Call (albero destinazioni design-time).
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { deriveExportedToolName } from '@domain/iaAgentTools/backendToolDerivation';
import {
  collectBackendSendLeavesFromTask,
  type BackendSendParamLeaf,
} from '@domain/openApi/backendSendParamCatalog';

export type BackendSendLeavesGroup = {
  backendTaskId: string;
  toolName: string;
  leaves: BackendSendParamLeaf[];
};

/**
 * Un gruppo per task Backend Call collegato (nessun merge cross-backend sui path).
 */
export function collectBackendSendLeavesByTask(
  backendTaskIds: readonly string[],
  getTask: (taskId: string) => Task | null | undefined
): BackendSendLeavesGroup[] {
  const out: BackendSendLeavesGroup[] = [];
  for (const id of backendTaskIds) {
    const backendTaskId = String(id ?? '').trim();
    if (!backendTaskId) continue;
    const task = getTask(backendTaskId);
    if (!task || task.type !== TaskType.BackendCall) continue;
    const leaves = collectBackendSendLeavesFromTask(task);
    if (leaves.length === 0) continue;
    const toolName = deriveExportedToolName(task).trim() || backendTaskId;
    out.push({ backendTaskId, toolName, leaves });
  }
  return out.sort((a, b) => a.toolName.localeCompare(b.toolName));
}
