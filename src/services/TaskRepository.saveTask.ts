// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * TaskRepository - Save Task to Database
 *
 * Unified save function that replaces all duplicate save functions.
 * This is a separate file to avoid circular dependencies.
 */

import { taskRepository } from './TaskRepository';
import type { Task } from '../types/taskTypes';

/**
 * Save task to database
 *
 * @param taskId - Task ID
 * @param projectId - Project ID
 * @throws Error if task not found or save fails
 */
export async function saveTaskToDatabase(
  taskId: string,
  projectId: string
): Promise<void> {
  const task = taskRepository.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found in repository`);
  }

  try {
    const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save task ${taskId}: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error(`[TaskRepository] Error saving task ${taskId} to database:`, error);
    throw error;
  }
}
