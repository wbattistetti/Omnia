/**
 * Builds a searchable corpus for the moved task (TaskRepository snapshot) for reference scanning.
 */

import { taskRepository } from '../../services/TaskRepository';

export function movedTaskReferenceCorpus(taskInstanceId: string): string {
  const tid = String(taskInstanceId || '').trim();
  if (!tid) return '';
  const task = taskRepository.getTask(tid);
  if (!task) return '';
  try {
    return JSON.stringify(task);
  } catch {
    return '';
  }
}
