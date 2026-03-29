/**
 * Single entry for TaskTree materialization: template-based and standalone use one code path (buildTaskTree).
 */

import type { Task, TaskTree } from '@types/taskTypes';
import { buildTaskTree } from '@utils/taskUtils';

export type MaterializeOptions = {
  projectId?: string;
};

/**
 * Returns a TaskTree for the editor, or null if the task cannot be materialized.
 */
export async function materializeTask(
  task: Task | null | undefined,
  options?: MaterializeOptions
): Promise<TaskTree | null> {
  if (!task) return null;
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
