// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType, taskTypeToTemplateId, taskIdToTaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { createRowWithTask, updateRowTaskType } from '@utils/taskHelpers';
import type { Row } from '@types/NodeRowTypes';

export interface RowTypeHandlerDependencies {
  row: Row;
  getProjectId?: () => string | undefined;
}

export interface RowTypeChangeResult {
  success: boolean;
  taskId?: string;
  taskType?: TaskType;
  templateId?: string | null;
  error?: Error;
}

/**
 * Service to handle row type changes and task creation/updates.
 * Extracted from NodeRow.tsx to separate business logic from UI concerns.
 */
export class RowTypeHandler {
  private row: Row;
  private getProjectId?: () => string | undefined;

  constructor(dependencies: RowTypeHandlerDependencies) {
    this.row = dependencies.row;
    this.getProjectId = dependencies.getProjectId;
  }

  /**
   * Handles changing the type of an existing row (when not in editing mode).
   * Updates or creates the task in the repository.
   */
  public async changeRowType(
    selectedTaskType: TaskType | null,
    selectedTask: any | null,
    label: string
  ): Promise<RowTypeChangeResult> {
    try {
      const taskId = this.row.id;
      const projectId = this.getProjectId?.() || undefined;
      let finalTaskType: TaskType;
      let templateId: string | null = null;

      if (selectedTask) {
        // Task "Other": use the templateId, icon and color from the selected task
        templateId = selectedTask.id || selectedTask.templateId || null;
        finalTaskType = selectedTask.type !== undefined ? selectedTask.type : TaskType.UNDEFINED;

        // Save icon and color in the task for use in visuals
        const updateDataWithVisuals: any = {
          type: finalTaskType,
          icon: selectedTask.icon || selectedTask.iconName || null,
          color: selectedTask.color || null,
        };
        if (templateId) {
          updateDataWithVisuals.templateId = templateId;
        }

        const existingTask = taskRepository.getTask(taskId);
        if (existingTask) {
          taskRepository.updateTask(taskId, updateDataWithVisuals, projectId);
        } else {
          const taskData: any = {
            ...(finalTaskType === TaskType.SayMessage ? { text: this.row.text || '' } : {}),
            icon: selectedTask.icon || selectedTask.iconName || null,
            color: selectedTask.color || null,
          };
          taskRepository.createTask(finalTaskType, templateId, taskData, taskId, projectId);
        }
      } else if (selectedTaskType !== null) {
        // TaskType enum: use directly
        finalTaskType = selectedTaskType;

        const existingTask = taskRepository.getTask(taskId);
        if (existingTask) {
          const updateData: any = { type: finalTaskType };
          if (templateId) {
            updateData.templateId = templateId;
          }
          taskRepository.updateTask(taskId, updateData, projectId);
        } else {
          // Create the task if it doesn't exist
          taskRepository.createTask(
            finalTaskType,
            templateId,
            finalTaskType === TaskType.SayMessage ? { text: this.row.text || '' } : undefined,
            taskId,
            projectId
          );
        }
      } else {
        return {
          success: false,
          error: new Error('No valid type provided')
        };
      }

      return {
        success: true,
        taskId,
        taskType: finalTaskType,
        templateId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Handles creating a task for a new row (when in editing mode).
   * Creates the task in the repository.
   */
  public async createTaskForNewRow(
    selectedTaskType: TaskType | null,
    selectedTask: any | null,
    label: string
  ): Promise<RowTypeChangeResult> {
    try {
      const taskId = this.row.id;
      const projectId = this.getProjectId?.() || undefined;
      let finalTaskType: TaskType;
      let templateId: string | null = null;

      if (selectedTask) {
        // Task "Other": create task with templateId
        finalTaskType = selectedTask.type !== undefined ? selectedTask.type : TaskType.UNDEFINED;
        templateId = selectedTask.id || selectedTask.templateId || null;

        if (!this.row.taskId) {
          taskRepository.createTask(
            finalTaskType,
            templateId,
            finalTaskType === TaskType.SayMessage ? { text: label } : undefined,
            taskId,
            projectId
          );
        } else {
          taskRepository.updateTask(taskId, { type: finalTaskType, templateId }, projectId);
        }
      } else if (selectedTaskType !== null) {
        // TaskType enum: determine key and create task
        const key = taskTypeToTemplateId(selectedTaskType) || '';
        const taskType = taskIdToTaskType(key);

        if (!this.row.taskId) {
          // Create Task for this row
          createRowWithTask(taskId, taskType, label, projectId);
        } else {
          // Update Task type
          updateRowTaskType(this.row, taskType, projectId);
        }

        finalTaskType = taskType;
      } else {
        return {
          success: false,
          error: new Error('No valid type provided')
        };
      }

      return {
        success: true,
        taskId,
        taskType: finalTaskType,
        templateId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}
