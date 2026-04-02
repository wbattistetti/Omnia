/**
 * Recomputes and stores Task.referenceScanInternalText from current task JSON and project variables.
 * Invoked on editor close and project save so reference scanning can use the persisted blob.
 */

import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { computeReferenceScanInternalTextForTask } from './referenceScanCompile';

/**
 * Persists the joined internal reference text for one task row. Returns false if the task is missing.
 */
export function persistReferenceScanInternalTextForTaskId(taskId: string, projectId: string): boolean {
  const task = taskRepository.getTask(taskId);
  if (!task) return false;
  const variables = variableCreationService.getAllVariables(projectId) ?? [];
  const text = computeReferenceScanInternalTextForTask(task, variables);
  return taskRepository.updateTask(
    taskId,
    { referenceScanInternalText: text },
    projectId,
    { merge: true }
  );
}
