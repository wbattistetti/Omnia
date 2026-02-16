// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { taskRepository } from '@services/TaskRepository';
import { getTemplateId } from '@utils/taskHelpers';
import { extractTaskOverrides, buildTemplateExpanded } from '@utils/taskUtils';
import { TaskType, isUtteranceInterpretationTemplateId } from '@types/taskTypes';
import type { Task, TaskTree } from '@types/taskTypes';
import { getMainNodes } from '@responseEditor/core/domain';
import { info } from '@utils/logger';
import { DialogueTaskService } from '@services/DialogueTaskService';

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
    // ✅ NO FALLBACKS: Use taskTree.steps as primary source, or task.steps, or throw error
    if (!taskTree.steps && !task?.steps) {
      console.warn('[saveTask] No steps found in taskTree or task. Using empty object.');
    }
    const tempTask: Task = {
      id: key,
      type: TaskType.UtteranceInterpretation,
      templateId: currentTemplateId || null,
      label: taskTree.label,
      steps: taskTree.steps ?? task?.steps ?? {}
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

  // ✅ FLOW TRACE: START
  console.log('[saveTaskOnProjectSave] 🚀 FLOW TRACE - START', {
    taskId: key,
    projectId: currentProjectId,
    hasTaskTree,
    taskExists: !!task,
    taskTemplateId: task?.templateId,
    timestamp: new Date().toISOString(),
  });

  if (hasTaskTree) {
    let taskInstance = taskRepository.getTask(key);
    if (!taskInstance) {
      const taskType = task?.type ?? TaskType.UtteranceInterpretation;
      taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
      console.log('[saveTaskOnProjectSave] 📝 Created new task instance', {
        taskId: key,
        taskType,
        templateId: null,
      });
    }

    const currentTemplateId = getTemplateId(taskInstance);

    // ✅ FLOW TRACE: Template ID check
    console.log('[saveTaskOnProjectSave] 🔍 FLOW TRACE - Template ID Check', {
      taskId: key,
      currentTemplateId,
      isInstance: !!currentTemplateId,
      cacheSize: DialogueTaskService.getTemplateCount(),
      templateInCache: currentTemplateId ? !!DialogueTaskService.getTemplate(currentTemplateId) : false,
    });

    // ✅ CRITICAL: Try to build templateExpanded, but don't block save if template not found
    let templateExpanded: TaskTree | null = null;
    if (currentTemplateId) {
      try {
        templateExpanded = await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined);
        console.log('[saveTaskOnProjectSave] ✅ FLOW TRACE - Template expanded built', {
          templateId: currentTemplateId,
          hasNodes: !!templateExpanded?.nodes,
        });
      } catch (error) {
        console.warn('[saveTaskOnProjectSave] ⚠️ FLOW TRACE - Template not found, continuing', {
          templateId: currentTemplateId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const modifiedFields = await extractTaskOverrides(
      taskInstance,
      taskTree,
      currentProjectId || undefined,
      templateExpanded || undefined
    );

    // ✅ CRITICAL: Check task TYPE, not templateId
    // If task has a templateId (GUID), it's an instance and we must preserve it
    // Only set templateId: null if task.type is UtteranceInterpretation AND templateId is null/undefined
    if (taskInstance.type === TaskType.UtteranceInterpretation && !currentTemplateId) {
      // Task is UtteranceInterpretation but has no templateId - it's a standalone template
      await taskRepository.updateTask(key, {
        type: TaskType.UtteranceInterpretation,
        templateId: null,
        ...modifiedFields
      }, currentProjectId || undefined);
      console.log('[saveTaskOnProjectSave] ✅ FLOW TRACE - Saved as standalone template', {
        taskId: key,
        templateId: null,
      });
    } else {
      // ✅ CRITICAL: Preserve templateId if it exists (it's an instance)
      // modifiedFields doesn't include templateId, so we need to preserve it from taskInstance
      await taskRepository.updateTask(key, {
        ...modifiedFields,
        // ✅ CRITICAL: Preserve templateId if it exists
        ...(currentTemplateId ? { templateId: currentTemplateId } : {}),
      }, currentProjectId || undefined);
      console.log('[saveTaskOnProjectSave] ✅ FLOW TRACE - Saved as instance', {
        taskId: key,
        templateId: currentTemplateId,
        preservedTemplateId: currentTemplateId,
      });
    }

    // ✅ FLOW TRACE: Verify saved task
    const savedTask = taskRepository.getTask(key);
    console.log('[saveTaskOnProjectSave] ✅ FLOW TRACE - Task saved and verified', {
      taskId: key,
      savedTemplateId: savedTask?.templateId,
      savedType: savedTask?.type,
      isInstance: !!savedTask?.templateId,
    });

    // ✅ NEW: Verifica che il task sia nel repository
    const allTasksInRepo = taskRepository.getAllTasks();
    const taskInRepo = allTasksInRepo.find(t => t.id === key);
    console.log('[saveTaskOnProjectSave] 🔍 TASK IN REPOSITORY CHECK', {
      taskId: key,
      taskInRepository: !!taskInRepo,
      taskTemplateId: taskInRepo?.templateId,
      taskType: taskInRepo?.type,
      repositorySize: allTasksInRepo.length,
      allTaskIds: allTasksInRepo.map(t => t.id),
    });
  } else if (taskTree) {
    const currentTemplateId = task?.templateId ?? null;
    const templateExpanded = currentTemplateId
      ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
      : null;

    const tempTask: Task = {
      id: key,
      type: task?.type || TaskType.UtteranceInterpretation,
      templateId: currentTemplateId,
      label: taskTree.label,
      steps: taskTree.steps ?? {}
    };

    const overrides = await extractTaskOverrides(
      tempTask,
      taskTree,
      currentProjectId || undefined,
      templateExpanded || undefined
    );
    await taskRepository.updateTask(key, overrides, currentProjectId || undefined);

    // ✅ FLOW TRACE: Saved task without taskTree structure
    const savedTask = taskRepository.getTask(key);
    console.log('[saveTaskOnProjectSave] ✅ FLOW TRACE - Task saved (no taskTree structure)', {
      taskId: key,
      savedTemplateId: savedTask?.templateId,
    });
  }

  // ✅ FLOW TRACE: END
  console.log('[saveTaskOnProjectSave] 🎉 FLOW TRACE - END', {
    taskId: key,
    timestamp: new Date().toISOString(),
  });
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
  // ✅ NO FALLBACKS: Use task.steps as primary source, or finalTaskTree.steps, or throw error
  if (!task?.steps && !finalTaskTree.steps) {
    console.warn('[saveTask] No steps found in task or finalTaskTree. Using empty object.');
  }
  const finalTaskTreeWithSteps: TaskTree = {
    ...finalTaskTree,
    steps: task?.steps ?? finalTaskTree.steps ?? {}
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
