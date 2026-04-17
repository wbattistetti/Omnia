// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { createRowWithTask, getTaskIdFromRow } from '@utils/taskHelpers';
import { applySayMessagePlainTextToTask } from '@utils/sayMessageTaskSync';
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
      let projectId: string | undefined = undefined;
      try {
        projectId = this.getCurrentProjectId?.() || this.getProjectId?.() || undefined;
      } catch {
        // Ignore errors getting project ID
      }

      if (projectId && ((this.row as any)?.mode === 'Message' || !(this.row as any)?.mode)) {
        const instanceId = this.row.id;

        const task = taskRepository.getTask(instanceId);

        if (!task) {
          const existingTask = taskRepository.getTask(this.row.id);
          if (!existingTask) {
            createRowWithTask(instanceId, TaskType.SayMessage, label, projectId);
          } else {
            applySayMessagePlainTextToTask(this.row.id, label, projectId);
          }
        } else {
          const taskId = getTaskIdFromRow(this.row);
          if (taskId) {
            applySayMessagePlainTextToTask(taskId, label, projectId);
          }
        }

        return {
          success: true,
          taskId: instanceId,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('[RowSaveHandler] saveRow failed', {
        error: String(error),
        rowId: this.row.id,
      });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
