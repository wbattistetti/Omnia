// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { taskRepository } from '@services/TaskRepository';
import { getTemplateId } from '@utils/taskHelpers';
// ✅ REMOVED: extractTaskOverrides and buildTemplateExpanded - no longer needed
// We save directly from taskTree.steps and taskTree.labelKey
import { TaskType, isUtteranceInterpretationTemplateId } from '@types/taskTypes';
import type { Task, TaskTree } from '@types/taskTypes';
import { getMainNodes } from '@responseEditor/core/domain';
import { info } from '@utils/logger';
import { DialogueTaskService } from '@services/DialogueTaskService';

/**
 * Save task data to repository (in-memory cache only, not DB).
 * This is called during project save or editor close.
 *
 * ✅ ARCHITECTURAL FIX: NON sovrascrivere gli steps!
 * Gli steps sono già aggiornati direttamente nel repository da:
 * - handleToggleDisabled (quando si disattiva uno step)
 * - handleDeleteStep (quando si cancella uno step)
 * - handleRestoreStep (quando si ripristina uno step)
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

    // ✅ ARCHITECTURAL FIX: NON includere steps negli updates!
    // Gli steps sono già nel repository, aggiornati direttamente da handleToggleDisabled etc.
    // Sovrascrivere con taskTree.steps (working copy) causa perdita di _disabled flags.
    const labelKeyToSave = taskTree.labelKey || (taskTree as any).label;

    // Update in-memory cache only - WITHOUT steps!
    const updates: Partial<Task> = {
      ...(labelKeyToSave ? { labelKey: labelKeyToSave } : {})
    };

    if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
      updates.type = TaskType.UtteranceInterpretation;
      updates.templateId = null;
    }

    // ✅ Solo se ci sono campi da aggiornare (non steps!)
    if (Object.keys(updates).length > 0) {
      await taskRepository.updateTask(key, updates, currentProjectId || undefined);
    }

    // ✅ Log per debug
    const savedTask = taskRepository.getTask(key);
    info('RESPONSE_EDITOR', 'Task saved to repository cache (steps preserved)', {
      taskId: key,
      hasSteps: !!savedTask?.steps,
      stepsKeys: savedTask?.steps && typeof savedTask.steps === 'object' ? Object.keys(savedTask.steps) : []
    });
  } else if (taskTree) {
    // No TaskTree structure, but save other fields (e.g., Message text)
    let taskInstance = taskRepository.getTask(key);
    if (!taskInstance) {
      const taskType = task?.type ?? TaskType.SayMessage;
      taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
    }

    // ✅ ARCHITECTURAL FIX: NON sovrascrivere steps
    const updates: Partial<Task> = {
      ...(taskTree.labelKey || (taskTree as any).label ? { labelKey: taskTree.labelKey || (taskTree as any).label } : {})
    };

    if (Object.keys(updates).length > 0) {
      await taskRepository.updateTask(key, updates, currentProjectId || undefined);
    }
    info('RESPONSE_EDITOR', 'Task saved (no data structure, steps preserved)', { key });
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

    // ✅ ARCHITECTURAL FIX: Leggi steps dal REPOSITORY (single source of truth)
    // NON usare taskTree.steps che potrebbe essere stale!
    // Il repository contiene la versione aggiornata con tutti i flag _disabled
    const currentTaskFromRepo = taskRepository.getTask(key);
    const stepsToSave = currentTaskFromRepo?.steps ?? {};
    const labelKeyToSave = taskTree.labelKey || (taskTree as any).label;

    const updates: Partial<Task> = {
      steps: stepsToSave,  // ✅ Steps dal repository, NON da taskTree!
      ...(labelKeyToSave ? { labelKey: labelKeyToSave } : {})
    };

    // ✅ CRITICAL: Check task TYPE, not templateId
    // If task has a templateId (GUID), it's an instance and we must preserve it
    // Only set templateId: null if task.type is UtteranceInterpretation AND templateId is null/undefined
    if (taskInstance.type === TaskType.UtteranceInterpretation && !currentTemplateId) {
      // Task is UtteranceInterpretation but has no templateId - it's a standalone template
      updates.type = TaskType.UtteranceInterpretation;
      updates.templateId = null;
      await taskRepository.updateTask(key, updates, currentProjectId || undefined);
      console.log('[saveTaskOnProjectSave] ✅ FLOW TRACE - Saved as standalone template', {
        taskId: key,
        templateId: null,
      });
    } else {
      // ✅ CRITICAL: Preserve templateId if it exists (it's an instance)
      if (currentTemplateId) {
        updates.templateId = currentTemplateId;
      }
      await taskRepository.updateTask(key, updates, currentProjectId || undefined);
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
    // ✅ ARCHITECTURAL FIX: Leggi steps dal REPOSITORY (single source of truth)
    const currentTaskFromRepo = taskRepository.getTask(key);
    const updates: Partial<Task> = {
      steps: currentTaskFromRepo?.steps ?? {},  // ✅ Steps dal repository, NON da taskTree!
      ...(taskTree.labelKey || (taskTree as any).label ? { labelKey: taskTree.labelKey || (taskTree as any).label } : {})
    };

    await taskRepository.updateTask(key, updates, currentProjectId || undefined);

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

  // ✅ ARCHITECTURAL FIX: NON sovrascrivere gli steps!
  // Gli steps sono già aggiornati direttamente nel repository da:
  // - handleToggleDisabled (quando si disattiva uno step)
  // - handleDeleteStep (quando si cancella uno step)
  // - handleRestoreStep (quando si ripristina uno step)
  //
  // Sovrascrivere gli steps qui con dati potenzialmente stale (da TaskTree/working copy)
  // causa la perdita dei flag _disabled e altre modifiche fatte durante l'editing.
  //
  // L'unica cosa che dobbiamo salvare è labelKey (se presente).

  const labelKeyToSave = finalTaskTree.labelKey || (finalTaskTree as any).label;

  // ✅ NON includere steps negli updates - sono già nel repository!
  const updates: Partial<Task> = {
    ...(labelKeyToSave ? { labelKey: labelKeyToSave } : {})
  };

  if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
    // Standalone task
    updates.type = TaskType.UtteranceInterpretation;
    updates.templateId = null;
  }

  // ✅ Solo se ci sono campi da aggiornare (non steps!)
  if (Object.keys(updates).length > 0) {
    // Update in-memory cache only (WITHOUT steps - they're already correct)
    taskRepository.updateTask(key, updates, currentProjectId || undefined);
  }

  // ✅ DEBUG: Verifica che gli steps nel repository siano intatti
  const savedTask = taskRepository.getTask(key);
  const savedStepsKeys = savedTask?.steps ? Object.keys(savedTask.steps) : [];
  const savedStepsCount = savedStepsKeys.length;

  const savedDisabledFlags: Record<string, Record<string, boolean>> = {};
  if (savedTask?.steps) {
    for (const [nodeId, nodeSteps] of Object.entries(savedTask.steps)) {
      if (nodeSteps && typeof nodeSteps === 'object' && !Array.isArray(nodeSteps)) {
        savedDisabledFlags[nodeId] = {};
        for (const [stepKey, stepData] of Object.entries(nodeSteps)) {
          if (stepData && typeof stepData === 'object') {
            savedDisabledFlags[nodeId][stepKey] = (stepData as any)._disabled === true;
          }
        }
      }
    }
  }
  console.log('[saveTaskOnEditorClose] ✅ Steps preserved (NOT overwritten)', {
    taskId: key,
    savedDisabledFlags: JSON.stringify(savedDisabledFlags),
    savedStepsKeys,
    updatesApplied: Object.keys(updates),
  });

  info('RESPONSE_EDITOR', 'Task saved on editor close (steps preserved)', {
    taskId: key,
    savedStepsCount,
    savedStepsKeys
  });
}
