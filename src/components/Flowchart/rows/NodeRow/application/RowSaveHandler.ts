// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { createRowWithTask, getTaskIdFromRow } from '@utils/taskHelpers';
import type { Row } from '@types/NodeRowTypes';

export interface RowSaveHandlerDependencies {
  row: Row;
  getProjectId?: () => string | undefined;
  getCurrentProjectId?: () => string | undefined;
}

export interface RowSaveResult {
  success: boolean;
  taskId?: string;
  error?: Error;
}

/**
 * Service to handle saving row data and updating/creating tasks.
 * Extracted from NodeRow.tsx to separate business logic from UI concerns.
 */
export class RowSaveHandler {
  private row: Row;
  private getProjectId?: () => string | undefined;
  private getCurrentProjectId?: () => string | undefined;

  constructor(dependencies: RowSaveHandlerDependencies) {
    this.row = dependencies.row;
    this.getProjectId = dependencies.getProjectId;
    this.getCurrentProjectId = dependencies.getCurrentProjectId;
  }

  /**
   * Saves the row label and updates/creates the associated task if it's a Message type.
   * Returns the result of the save operation.
   */
  public async saveRow(label: string): Promise<RowSaveResult> {
    try {
      // Get project ID
      let projectId: string | undefined = undefined;
      try {
        projectId = this.getCurrentProjectId?.() || this.getProjectId?.() || undefined;
      } catch {
        // Ignore errors getting project ID
      }

      // Only save task for Message type rows
      if (projectId && ((this.row as any)?.mode === 'Message' || !(this.row as any)?.mode)) {
        const instanceId = (this.row as any)?.instanceId ?? this.row.id;

        console.log('[RowSaveHandler][SAVE][START]', {
          rowId: this.row.id,
          rowInstanceId: (this.row as any)?.instanceId,
          finalInstanceId: instanceId,
          label,
          labelLength: label.length,
          projectId,
          rowMode: (this.row as any)?.mode,
        });

        // Ensure task exists in memory before saving
        const task = taskRepository.getTask(instanceId);
        console.log('[RowSaveHandler][SAVE][MEMORY_CHECK]', {
          instanceId,
          taskExists: !!task,
          taskMessage: task?.value?.text || 'N/A',
        });

        if (!task) {
          // Create task in memory if it doesn't exist
          console.log('[RowSaveHandler][SAVE][CREATE_IN_MEMORY]', { instanceId });

          // Create Task if row doesn't have taskId
          if (!this.row.taskId) {
            // Create Task for this row (default to Message type)
            const newTask = createRowWithTask(instanceId, TaskType.SayMessage, label, projectId);
            // Architectural rule: task.id = row.id (newTask.id === instanceId === row.id)
            console.log('[RowSaveHandler][SAVE][CREATED_AND_UPDATED]', {
              instanceId,
              taskId: this.row.taskId,
              messageText: label.substring(0, 50),
            });
          } else {
            // Row already has Task, update it
            taskRepository.updateTask(this.row.taskId, { text: label }, projectId);
            console.log('[RowSaveHandler][SAVE][UPDATED_EXISTING]', {
              instanceId,
              taskId: this.row.taskId,
              messageText: label.substring(0, 50),
            });
          }
        } else {
          // Update existing task
          console.log('[RowSaveHandler][SAVE][UPDATE_IN_MEMORY]', {
            instanceId,
            oldText: task.text?.substring(0, 50) || 'N/A',
            newText: label.substring(0, 50),
          });

          // Update Task (TaskRepository internally updates InstanceRepository)
          const taskId = getTaskIdFromRow(this.row);
          if (taskId) {
            taskRepository.updateTask(taskId, { text: label }, projectId);
          }
        }

        // Verify after update
        const taskAfter = taskRepository.getTask(instanceId);
        console.log('[RowSaveHandler][SAVE][MEMORY_AFTER_UPDATE]', {
          instanceId,
          taskExists: !!taskAfter,
          messageText: taskAfter?.value?.text?.substring(0, 50) || 'N/A',
        });

        return {
          success: true,
          taskId: instanceId,
        };
      } else {
        console.log('[RowSaveHandler][SAVE][SKIPPED]', {
          hasProjectId: !!projectId,
          rowMode: (this.row as any)?.mode,
          rowInstanceId: (this.row as any)?.instanceId,
          reason: !projectId ? 'NO_PROJECT_ID' : 'NOT_MESSAGE_MODE',
        });

        return {
          success: true, // Not an error, just skipped
        };
      }
    } catch (error) {
      console.error('[RowSaveHandler][SAVE][ERROR]', {
        error: String(error),
        rowId: this.row.id,
        label: label.substring(0, 50),
      });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
