/**
 * Keeps TaskRepository rows aligned with DialogueTaskService template cache for project template
 * definitions. GrammarFlow and recognition mutate the in-memory template first; this sync ensures
 * the repository copy (used after reload and for non-editor paths) matches before project save.
 */

import type { Task } from '@types/taskTypes';
import { taskRepository } from '../TaskRepository';
import type { DialogueTask } from '../DialogueTaskService';
import { isProjectTemplateDefinitionRowForTemplateEndpointOnly } from './projectBulkTaskRules';

/**
 * Copies `dataContract` (and minimal template fields) from the dialogue template cache into the
 * TaskRepository row when that row is a project template definition document.
 */
export function syncProjectTemplateRowFromDialogueTask(
  templateId: string,
  template: DialogueTask | null | undefined
): void {
  if (!template) {
    return;
  }
  const row = taskRepository.getTask(templateId);
  if (!row) {
    return;
  }
  if (!isProjectTemplateDefinitionRowForTemplateEndpointOnly(row)) {
    return;
  }

  const updates: Partial<Task> = {};

  if (template.dataContract !== undefined) {
    updates.dataContract = template.dataContract
      ? JSON.parse(JSON.stringify(template.dataContract))
      : undefined;
  }
  if (template.label !== undefined) {
    (updates as Record<string, unknown>).label = template.label;
  }
  if (template.constraints !== undefined) {
    updates.constraints = template.constraints;
  }
  if (template.subTasksIds !== undefined) {
    updates.subTasksIds = template.subTasksIds;
  }
  if (template.steps !== undefined) {
    updates.steps = template.steps;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  taskRepository.updateTask(templateId, updates, undefined, { merge: false });
}
