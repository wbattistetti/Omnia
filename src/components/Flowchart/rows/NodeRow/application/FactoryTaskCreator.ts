// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType, taskTypeToTemplateId, taskIdToTaskType } from '@types/taskTypes';
import { createRowWithTask, updateRowTaskType } from '@utils/taskHelpers';
import { taskRepository } from '@services/TaskRepository';
import { emitSidebarRefresh } from '@ui/events';
import type { Row } from '@types/NodeRowTypes';

export interface FactoryTaskCreatorDependencies {
  row: Row;
  getProjectId?: () => string | undefined;
  onCreateFactoryTask: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string, type?: string) => void;
  onUpdate: (row: Row, label: string) => void;
  onUpdateWithCategory?: (row: Row, label: string, categoryType?: string, meta?: any) => void;
  onStateUpdate: {
    setIsEditing: (value: boolean) => void;
    setShowIntellisense: (value: boolean) => void;
    setIntellisenseQuery: (value: string) => void;
    closePicker: () => void;
  };
}

export interface FactoryTaskCreationResult {
  success: boolean;
  error?: Error;
}

/**
 * Application service for creating Factory Tasks from NodeRow.
 * Handles the complex logic of creating a factory task, updating the task repository,
 * and updating the row with the created task metadata.
 */
export class FactoryTaskCreator {
  constructor(private deps: FactoryTaskCreatorDependencies) {}

  /**
   * Creates a factory task for a new row when editing.
   * This is called when onCreateFactoryTask is available and the user is creating a new row.
   */
  async createFactoryTask(
    label: string,
    selectedTaskType: TaskType | null
  ): Promise<FactoryTaskCreationResult> {
    try {
      const { row, onCreateFactoryTask } = this.deps;

      const key = selectedTaskType !== null ? taskTypeToTemplateId(selectedTaskType) || '' : '';

      onCreateFactoryTask(label, (createdItem: any) => {
        this.handleFactoryTaskCreated(createdItem, label, key);
      }, 'industry', undefined, key);

      return { success: true };
    } catch (err) {
      console.warn('[FactoryTaskCreator] Failed to create factory task:', err);
      this.deps.onStateUpdate.setIsEditing(false);
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err))
      };
    }
  }

  /**
   * Handles the callback when a factory task is created.
   * Updates the task repository and row metadata.
   */
  private handleFactoryTaskCreated(
    createdItem: any,
    label: string,
    key: string
  ): void {
    const { row, getProjectId, onUpdate, onUpdateWithCategory, onStateUpdate } = this.deps;

    const instanceId = row.id;
    const projectId = getProjectId?.() || undefined;

    const taskType = taskIdToTaskType(key);
    const existingTask = taskRepository.getTask(row.id);
    if (!existingTask) {
      createRowWithTask(instanceId, taskType, '', projectId);
    } else {
      updateRowTaskType(row, taskType, projectId);
    }

    const finalType = createdItem?.type ?? key;

    const updateMeta = {
      id: instanceId,
      type: finalType,
      factoryId: createdItem?.factoryId,
      isUndefined: false
    };

    if (onUpdateWithCategory) {
      (onUpdateWithCategory as any)(row, label, 'taskTemplates', updateMeta);
    } else {
      onUpdate({ ...row, isUndefined: false } as any, label);
    }

    onStateUpdate.setIsEditing(false);
    onStateUpdate.setShowIntellisense(false);
    onStateUpdate.setIntellisenseQuery('');
    onStateUpdate.closePicker();

    try {
      emitSidebarRefresh();
    } catch {
      // Ignore errors
    }
  }
}
