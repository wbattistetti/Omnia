// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { taskRepository } from '@services/TaskRepository';
import { getTemplateId } from '@utils/taskHelpers';
import { TaskType, isUtteranceInterpretationTemplateId } from '@types/taskTypes';
import type { Task, TaskTree } from '@types/taskTypes';
import { getMainNodes } from '@responseEditor/core/domain';
import { info } from '@utils/logger';
import {
  cloneMainNodesForInstancePersistence,
  shouldPersistStandaloneInstanceSnapshot,
} from '@responseEditor/core/persistence/standaloneInstanceSnapshot';

/**
 * Save task options
 */
export interface SaveTaskOptions {
  /** If true, include steps from repository (for DB persistence). Default: false */
  includeStepsForPersistence?: boolean;
  /** Project ID for context */
  projectId?: string | null;
}

/**
 * Unified save function for task data.
 *
 * ARCHITECTURAL PRINCIPLE:
 * - Steps are NEVER taken from taskTree (working copy) - they may be stale
 * - Steps are ONLY read from repository (single source of truth)
 * - Steps are modified directly by handleToggleDisabled, handleDeleteStep, handleRestoreStep
 *
 * @param taskId - Task ID
 * @param taskTree - TaskTree (used only for labelKey, NOT for steps)
 * @param task - Original task (for type info)
 * @param options - Save options
 */
export async function saveTask(
  taskId: string,
  taskTree: TaskTree,
  task: Task | null,
  options: SaveTaskOptions = {}
): Promise<void> {
  const { includeStepsForPersistence = false, projectId = null } = options;
  const key = taskId;
  const currentMainList = getMainNodes(taskTree);
  const hasTaskTree = taskTree && Object.keys(taskTree).length > 0 && currentMainList && currentMainList.length > 0;

  // Get or create task instance
  let taskInstance = taskRepository.getTask(key);
  if (!taskInstance) {
    const taskType = task?.type ?? (hasTaskTree ? TaskType.UtteranceInterpretation : TaskType.SayMessage);
    taskInstance = taskRepository.createTask(taskType, null, undefined, key, projectId || undefined);
  }

  const currentTemplateId = getTemplateId(taskInstance);
  const labelKeyToSave = taskTree?.labelKey || (taskTree as any)?.label;

  // Build updates object
  const updates: Partial<Task> = {
    ...(labelKeyToSave ? { labelKey: labelKeyToSave } : {})
  };

  // Only include steps when persisting to DB (read from repository, not taskTree!)
  if (includeStepsForPersistence) {
    const currentTaskFromRepo = taskRepository.getTask(key);
    updates.steps = currentTaskFromRepo?.steps ?? {};
  }

  // Handle standalone tasks (no template)
  if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
    if (taskInstance.type === TaskType.UtteranceInterpretation && !currentTemplateId) {
      updates.type = TaskType.UtteranceInterpretation;
      updates.templateId = null;
    }
  }

  // Preserve templateId if it exists
  if (currentTemplateId && includeStepsForPersistence) {
    updates.templateId = currentTemplateId;
  }

  if (shouldPersistStandaloneInstanceSnapshot(taskInstance, taskTree)) {
    updates.kind = 'standalone';
    updates.instanceNodes = cloneMainNodesForInstancePersistence(taskTree);
  }

  // Only update if there are changes
  if (Object.keys(updates).length > 0) {
    await taskRepository.updateTask(key, updates, projectId || undefined);
  }

  // Log result
  const savedTask = taskRepository.getTask(key);
  info('RESPONSE_EDITOR', 'Task saved', {
    taskId: key,
    includeSteps: includeStepsForPersistence,
    hasSteps: !!savedTask?.steps,
    stepsKeys: savedTask?.steps ? Object.keys(savedTask.steps) : []
  });
}

/**
 * Save task to repository (in-memory cache only, not DB).
 * Called during editor operations.
 *
 * @deprecated Use saveTask() instead
 */
export async function saveTaskToRepository(
  taskId: string,
  taskTree: TaskTree,
  task: Task | null,
  currentProjectId: string | null
): Promise<void> {
  return saveTask(taskId, taskTree, task, {
    includeStepsForPersistence: false,
    projectId: currentProjectId
  });
}

/**
 * Save task on project save event.
 * Called when user clicks "Save project" button.
 * Includes steps from repository for DB persistence.
 *
 * @deprecated Use saveTask({ includeStepsForPersistence: true }) instead
 */
export async function saveTaskOnProjectSave(
  taskId: string,
  taskTree: TaskTree,
  task: Task | null,
  currentProjectId: string | null
): Promise<void> {
  return saveTask(taskId, taskTree, task, {
    includeStepsForPersistence: true,
    projectId: currentProjectId
  });
}

/**
 * Save task on editor close.
 * Called when editor closes - only saves metadata, NOT steps.
 * Steps are already in repository from direct updates.
 *
 * @deprecated Use saveTask() instead
 */
export async function saveTaskOnEditorClose(
  taskId: string,
  finalTaskTree: TaskTree,
  task: Task | null,
  currentProjectId: string | null
): Promise<void> {
  return saveTask(taskId, finalTaskTree, task, {
    includeStepsForPersistence: false,
    projectId: currentProjectId
  });
}
