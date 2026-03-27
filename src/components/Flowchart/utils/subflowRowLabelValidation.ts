/**
 * Detects duplicate normalized row labels among Subflow tasks in the same flow canvas.
 */
import { TaskType } from '../../../types/taskTypes';
import { taskRepository } from '../../../services/TaskRepository';
import { variableCreationService } from '../../../services/VariableCreationService';

type FlowRowsShape = Record<
  string,
  { nodes?: Array<{ data?: { rows?: Array<{ id?: string; text?: string }> } }> } | undefined
>;

/**
 * Returns duplicate info if another Subflow row (other than currentRowTaskId) shares the same
 * normalized label as newLabel.
 */
export function findDuplicateNormalizedSubflowRowLabel(
  activeFlowId: string,
  flows: FlowRowsShape,
  currentRowTaskId: string,
  newLabel: string
): { duplicateRowTaskId: string; duplicateRowText: string } | null {
  const norm = variableCreationService.normalizeTaskLabel(String(newLabel || '').trim() || 'Subflow');
  const flow = flows[activeFlowId];
  if (!flow) return null;
  for (const node of flow.nodes || []) {
    for (const row of node?.data?.rows || []) {
      const taskId = String(row?.id || '').trim();
      if (!taskId || taskId === currentRowTaskId) continue;
      const task = taskRepository.getTask(taskId);
      if (!task || task.type !== TaskType.Subflow) continue;
      const otherNorm = variableCreationService.normalizeTaskLabel(
        String(row?.text || task?.name || '').trim() || 'Subflow'
      );
      if (otherNorm === norm) {
        return { duplicateRowTaskId: taskId, duplicateRowText: String(row?.text || '').trim() };
      }
    }
  }
  return null;
}
