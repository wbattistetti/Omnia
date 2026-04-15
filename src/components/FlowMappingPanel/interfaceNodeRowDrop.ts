/**
 * Rules for pointer-dragging a flow node row onto the Interface panel (semantic binding only).
 * Task classification uses {@link resolveTaskType} on the row, not legacy `row.type`.
 */

import { variableCreationService } from '../../services/VariableCreationService';
import { TaskType } from '../../types/taskTypes';
import { resolveTaskType } from '../Flowchart/utils/taskVisuals';

/**
 * Tasks whose in-memory variable rows can be expanded onto Input/Output (Utterance / classification).
 */
export function taskRowAllowsInterfaceVariableExpansionFromRow(row: unknown): boolean {
  const t = resolveTaskType(row as Parameters<typeof resolveTaskType>[0]);
  return t === TaskType.UtteranceInterpretation || t === TaskType.ClassifyProblem;
}

/** Variable GUIDs owned by this task row instance (row.id === task.id). */
export function getVariableRefIdsBoundToTaskRow(
  projectId: string | undefined,
  taskRowId: string
): string[] {
  const pid = String(projectId || '').trim();
  const tid = String(taskRowId || '').trim();
  if (!pid || !tid) return [];
  return variableCreationService
    .getAllVariables(pid)
    .filter((v) => String(v.taskInstanceId || '').trim() === tid)
    .map((v) => String(v.id || '').trim())
    .filter(Boolean);
}
