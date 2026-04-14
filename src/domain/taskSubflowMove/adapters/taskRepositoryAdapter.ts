/**
 * Task repository port for the canonical pipeline (delegates to TaskRepository).
 */

import type { Task } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';

export type TaskRepositoryAdapter = {
  getTask(taskInstanceId: string): Task | undefined;
};

export function createDefaultTaskRepositoryAdapter(): TaskRepositoryAdapter {
  return {
    getTask: (id) => taskRepository.getTask(id),
  };
}
