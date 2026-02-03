/**
 * ResponseEditorPersistence
 *
 * Pure persistence logic for ResponseEditor (no React hooks).
 * Handles saving and loading of task data, template synchronization,
 * and cache management.
 *
 * This module is extracted from index.tsx to separate concerns and
 * improve maintainability. All functions are pure and side-effect free
 * (except for actual persistence operations).
 */

import { taskRepository } from '../../../../../../services/TaskRepository';
import { getTemplateId } from '../../../../../../utils/taskHelpers';
import { extractTaskOverrides, buildTemplateExpanded, syncTasksWithTemplate, markTaskAsEdited } from '../../../../../../utils/taskUtils';
import { TaskType, isUtteranceInterpretationTemplateId } from '../../../../../../types/taskTypes';
import type { Task, TaskTree } from '../../../../../../types/taskTypes';
import { getdataList } from '../../../ddtSelectors';
import { info } from '../../../../../../utils/logger';

/**
 * Save task data to repository (in-memory cache only, not DB).
 * This is called during project save or editor close.
 */
export async function saveTaskToRepository(
  taskId: string,
  taskTree: TaskTree,
  task: Task | null,
  currentProjectId: string | null
): Promise<void> {
  const key = taskId;
  const currentMainList = getdataList(taskTree);
  const hasTaskTree = taskTree && Object.keys(taskTree).length > 0 && currentMainList && currentMainList.length > 0;

  if (hasTaskTree) {
    // Get or create task instance
    let taskInstance = taskRepository.getTask(key);
    if (!taskInstance) {
      const taskType = task?.type ?? TaskType.UtteranceInterpretation;
      taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
    }

    const currentTemplateId = getTemplateId(taskInstance);

    // Create templateExpanded (baseline from current template)
    const templateExpanded = currentTemplateId
      ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
      : null;

    // Create temporary task for extractTaskOverrides
    const tempTask: Task = {
      id: key,
      type: TaskType.UtteranceInterpretation,
      templateId: currentTemplateId || null,
      label: taskTree.label,
      steps: taskTree.steps || task?.steps || {}
    };

    // Extract overrides (full working copy with edited flags)
    const dataToSave = await extractTaskOverrides(
      tempTask,
      taskTree,
      currentProjectId || undefined,
      templateExpanded || undefined
    );

    // Update in-memory cache only (DB save happens on explicit "Save project" command)
    if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
      await taskRepository.updateTask(key, {
        type: TaskType.UtteranceInterpretation,
        templateId: null,
        ...dataToSave
      }, currentProjectId || undefined);
    } else {
      await taskRepository.updateTask(key, dataToSave, currentProjectId || undefined);
    }

    info('RESPONSE_EDITOR', 'Task saved to repository cache', {
      taskId: key,
      hasDataToSave: !!dataToSave,
      dataToSaveKeys: dataToSave ? Object.keys(dataToSave) : []
    });
  } else if (taskTree) {
    // No TaskTree structure, but save other fields (e.g., Message text)
    let taskInstance = taskRepository.getTask(key);
    if (!taskInstance) {
      const taskType = task?.type ?? TaskType.SayMessage;
      taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
    }
    const overrides = await extractTaskOverrides(taskInstance, taskTree, currentProjectId || undefined);
    await taskRepository.updateTask(key, overrides, currentProjectId || undefined);
    info('RESPONSE_EDITOR', 'Task saved (no data structure)', { key });
  }
}

/**
 * Save task on project save event.
 * This is called when the user clicks "Save project" button.
 */
export async function saveTaskOnProjectSave(
  taskId: string,
  taskTree: TaskTree,
  task: Task | null,
  currentProjectId: string | null
): Promise<void> {
  const key = taskId;
  const currentMainList = getdataList(taskTree);
  const hasTaskTree = taskTree && Object.keys(taskTree).length > 0 && currentMainList && currentMainList.length > 0;

  if (hasTaskTree) {
    let taskInstance = taskRepository.getTask(key);
    if (!taskInstance) {
      const taskType = task?.type ?? TaskType.UtteranceInterpretation;
      taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
    }

    const currentTemplateId = getTemplateId(taskInstance);
    const templateExpanded = currentTemplateId
      ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
      : null;

    const modifiedFields = await extractTaskOverrides(
      taskInstance,
      taskTree,
      currentProjectId || undefined,
      templateExpanded || undefined
    );

    if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
      await taskRepository.updateTask(key, {
        type: TaskType.UtteranceInterpretation,
        templateId: null,
        ...modifiedFields
      }, currentProjectId || undefined);
    } else {
      await taskRepository.updateTask(key, modifiedFields, currentProjectId || undefined);
    }
  } else if (taskTree) {
    const currentTemplateId = task?.templateId || null;
    const templateExpanded = currentTemplateId
      ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
      : null;

    const tempTask: Task = {
      id: key,
      type: task?.type || TaskType.UtteranceInterpretation,
      templateId: currentTemplateId,
      label: taskTree.label,
      steps: taskTree.steps || {}
    };

    const overrides = await extractTaskOverrides(
      tempTask,
      taskTree,
      currentProjectId || undefined,
      templateExpanded || undefined
    );
    await taskRepository.updateTask(key, overrides, currentProjectId || undefined);
  }
}

/**
 * Save task on editor close.
 * This prepares the final TaskTree with steps and saves to cache.
 */
export async function saveTaskOnEditorClose(
  taskId: string,
  finalTaskTree: TaskTree,
  task: Task | null,
  currentProjectId: string | null
): Promise<void> {
  const key = taskId;

  // Get or create task instance
  let taskInstance = taskRepository.getTask(key);
  if (!taskInstance) {
    const taskType = task?.type ?? TaskType.UtteranceInterpretation;
    taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
  }

  const currentTemplateId = getTemplateId(taskInstance);

  // Add task.steps to finalTaskTree (single source of truth for steps)
  const finalTaskTreeWithSteps: TaskTree = {
    ...finalTaskTree,
    steps: task?.steps || finalTaskTree.steps || {}
  };

  // Save based on template type
  if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
    // Standalone task
    const templateExpanded = currentTemplateId
      ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
      : null;

    const tempTask: Task = {
      id: key,
      type: TaskType.UtteranceInterpretation,
      templateId: currentTemplateId || null,
      label: finalTaskTreeWithSteps.label,
      steps: finalTaskTreeWithSteps.steps
    };

    const dataToSave = await extractTaskOverrides(
      tempTask,
      finalTaskTreeWithSteps,
      currentProjectId || undefined,
      templateExpanded || undefined
    );

    // Update in-memory cache only
    taskRepository.updateTask(key, dataToSave, currentProjectId || undefined);
  } else {
    // Task with templateId
    const templateExpanded = currentTemplateId
      ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
      : null;

    const tempTask: Task = {
      id: key,
      type: TaskType.UtteranceInterpretation,
      templateId: currentTemplateId || null,
      label: finalTaskTreeWithSteps.label,
      steps: finalTaskTreeWithSteps.steps
    };

    const dataToSave = await extractTaskOverrides(
      tempTask,
      finalTaskTreeWithSteps,
      currentProjectId || undefined,
      templateExpanded || undefined
    );

    // Update in-memory cache only
    taskRepository.updateTask(key, dataToSave, currentProjectId || undefined);
  }

  // Verify steps were saved
  const savedTask = taskRepository.getTask(key);
  const savedStepsKeys = savedTask?.steps ? Object.keys(savedTask.steps) : [];
  const savedStepsCount = savedStepsKeys.length;

  info('RESPONSE_EDITOR', 'Task saved on editor close', {
    taskId: key,
    savedStepsCount,
    savedStepsKeys
  });
}

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
    const { default: DialogueTaskService } = await import('../../../../../../services/DialogueTaskService');
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
