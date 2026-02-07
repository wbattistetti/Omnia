// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { syncTasksWithTemplate, markTaskAsEdited } from '@utils/taskUtils';
import type { Task, TaskTree } from '@types/taskTypes';
import { info } from '@utils/logger';

/**
 * Check if template sync is needed and apply updates if user confirms.
 * Returns true if sync was applied, false otherwise.
 */
export async function checkAndApplyTemplateSync(
  taskTree: TaskTree,
  task: Task | null,
  currentProjectId: string | null
): Promise<boolean> {
  if (!taskTree || !task?.templateId) {
    return false;
  }

  try {
    const { default: DialogueTaskService } = await import('@services/DialogueTaskService');
    const template = DialogueTaskService.getTemplate(task.templateId);
    if (!template) {
      return false;
    }

    const syncNeeded = await syncTasksWithTemplate(
      taskTree.steps,
      template,
      task.templateId
    );

    if (syncNeeded.length > 0) {
      const shouldSync = window.confirm(
        `Il template è stato aggiornato. Vuoi ereditare i nuovi valori per ${syncNeeded.length} task?`
      );

      if (shouldSync) {
        // Apply template updates
        syncNeeded.forEach(({ templateId, stepType, escalationIndex, taskIndex, templateTask }) => {
          const nodeSteps = taskTree.steps[templateId];
          if (!nodeSteps) return;

          // Case A: steps as object
          if (!Array.isArray(nodeSteps) && nodeSteps[stepType]) {
            const step = nodeSteps[stepType];
            if (step?.escalations?.[escalationIndex]?.tasks?.[taskIndex]) {
              const task = step.escalations[escalationIndex].tasks[taskIndex];
              task.text = templateTask.text;
              task.parameters = templateTask.parameters;
              task.edited = false; // Keep as inherited
            }
          }

          // Case B: steps as array
          if (Array.isArray(nodeSteps)) {
            const group = nodeSteps.find((g: any) => g?.type === stepType);
            if (group?.escalations?.[escalationIndex]?.tasks?.[taskIndex]) {
              const task = group.escalations[escalationIndex].tasks[taskIndex];
              task.text = templateTask.text;
              task.parameters = templateTask.parameters;
              task.edited = false; // Keep as inherited
            }
          }
        });

        return true;
      } else {
        // Mark all as edited
        syncNeeded.forEach(({ templateId, stepType, escalationIndex, taskIndex }) => {
          markTaskAsEdited(taskTree.steps, templateId, stepType, escalationIndex, taskIndex);
        });
        return false;
      }
    }
  } catch (error) {
    info('RESPONSE_EDITOR', 'Error checking template sync', { error });
  }

  return false;
}
