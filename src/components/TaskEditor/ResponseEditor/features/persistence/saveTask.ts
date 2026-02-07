// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { taskRepository } from '@services/TaskRepository';
import { getTemplateId } from '@utils/taskHelpers';
import { extractTaskOverrides, buildTemplateExpanded } from '@utils/taskUtils';
import { TaskType, isUtteranceInterpretationTemplateId } from '@types/taskTypes';
import type { Task, TaskTree } from '@types/taskTypes';
import { getMainNodes } from '@responseEditor/core/domain';
import { info } from '@utils/logger';

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
  const currentMainList = getMainNodes(taskTree);
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
  const currentMainList = getMainNodes(taskTree);
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
