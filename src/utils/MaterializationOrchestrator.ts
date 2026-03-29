/**
 * Single entry for TaskTree materialization during migration.
 * Standalone branch uses local persisted fields; all other kinds delegate to buildTaskTree.
 */

import type { Task, TaskTree } from '@types/taskTypes';
import { buildStandaloneTaskTreeView } from '@utils/buildStandaloneTaskTreeView';
import { inferTaskKind } from '@utils/taskKind';
import { buildTaskTree } from '@utils/taskUtils';

export type MaterializeOptions = {
  projectId?: string;
};

/**
 * Returns a TaskTree for the editor, or null if the task cannot be materialized.
 * Template-only rows (projectTemplate/factoryTemplate) use the same path as today via buildTaskTree
 * once the editor passes an appropriate instance wrapper; standalone uses only local fields.
 */
export async function materializeTask(
  task: Task | null | undefined,
  options?: MaterializeOptions
): Promise<TaskTree | null> {
  if (!task) return null;

  const kind = inferTaskKind(task);

  if (kind === 'standalone') {
    return buildStandaloneTaskTreeView(task);
  }

  return buildTaskTree(task, options?.projectId);
}

/**
 * Loads a fresh task from TaskRepository and materializes it (same contract as buildTaskTreeFromRepository).
 */
export async function materializeTaskFromRepository(
  taskId: string,
  projectId?: string
): Promise<{ taskTree: TaskTree; instance: Task } | null> {
  const { taskRepository } = await import('@services/TaskRepository');
  const freshInstance = taskRepository.getTask(taskId);
  if (!freshInstance) {
    console.warn(`[materializeTaskFromRepository] Task ${taskId} not found in repository`);
    return null;
  }

  const taskTree = await materializeTask(freshInstance, { projectId });
  if (!taskTree) {
    return null;
  }

  const instanceAfter = taskRepository.getTask(taskId) ?? freshInstance;
  return { taskTree, instance: instanceAfter };
}
