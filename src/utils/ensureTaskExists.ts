/**
 * Ensures a flow-row task exists in TaskRepository before materialization, wizard, or manual edit.
 * Missing tasks are created as pure standalone shells (templateId null, empty steps/instanceNodes).
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';

export type EnsureTaskExistsOptions = {
  taskType?: TaskType;
  projectId?: string;
  label?: string;
};

/**
 * Returns the task for `rowId`, creating it in the repository if absent.
 */
export function ensureTaskExists(rowId: string, options?: EnsureTaskExistsOptions): Task {
  const existing = taskRepository.getTask(rowId);
  if (existing) {
    if (
      existing.kind === 'standalone' &&
      existing.templateId != null &&
      existing.templateId !== 'UNDEFINED'
    ) {
      taskRepository.updateTask(
        rowId,
        { templateId: null },
        options?.projectId,
        { allowClearTemplateId: true }
      );
      const updated = taskRepository.getTask(rowId);
      if (updated) return updated;
    }
    return existing;
  }

  const type = options?.taskType ?? TaskType.UtteranceInterpretation;

  return taskRepository.createTask(
    type,
    null,
    {
      steps: {},
      instanceNodes: [],
      kind: 'standalone',
      ...(options?.label ? { label: options.label } : {}),
    },
    rowId,
    options?.projectId
  );
}
