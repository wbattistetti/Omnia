// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType, taskTypeToTemplateId, taskIdToTaskType } from '@types/taskTypes';
import { createRowWithTask, updateRowTaskType } from '@utils/taskHelpers';
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
      const { row, getProjectId, onCreateFactoryTask, onUpdate, onUpdateWithCategory, onStateUpdate } = this.deps;

      // Determine the key from selectedTaskType
      const key = selectedTaskType !== null ? taskTypeToTemplateId(selectedTaskType) || '' : '';

      console.log('🎯 [FactoryTaskCreator][CALLING_CREATE_FACTORY_TASK]', {
        label,
        taskType: selectedTaskType,
        key,
        timestamp: Date.now()
      });

      // Create the factory task with the row name and inferred type
      // The callback onRowUpdate is called immediately by EntityCreationService
      onCreateFactoryTask(label, (createdItem: any) => {
        this.handleFactoryTaskCreated(createdItem, label, key);
      }, 'industry', undefined, key);

      console.log('🎯 [FactoryTaskCreator][AFTER_CALLING_CREATE_FACTORY_TASK]', {
        label,
        timestamp: Date.now()
      });

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

    console.log('🎯 [FactoryTaskCreator][CALLBACK_START]', {
      label,
      createdItem,
      hasCreatedItem: !!createdItem,
      id: createdItem?.id,
      type: createdItem?.type,
      mode: createdItem?.mode,
      timestamp: Date.now()
    });

    const createdItemId = createdItem?.id;
    console.log('🎯 [FactoryTaskCreator] Factory task created:', {
      label,
      id: createdItemId,
      type: createdItem?.type,
      mode: createdItem?.mode
    });

    // Update row with template metadata
    const instanceId = row.id;
    const projectId = getProjectId?.() || undefined;

    // Migration: Create or update Task
    // Convert key (string from Intellisense) to TaskType enum
    const taskType = taskIdToTaskType(key);
    if (!row.taskId) {
      // Create Task for this row
      createRowWithTask(instanceId, taskType, '', projectId);
    } else {
      // Update Task type
      updateRowTaskType(row, taskType, projectId);
    }

    const finalType = createdItem?.type ?? key;

    const updateMeta = {
      id: instanceId,
      type: finalType,
      factoryId: createdItem?.factoryId,
      isUndefined: false
    };

    console.log('🎯 [FactoryTaskCreator][BEFORE_UPDATE]', {
      rowId: row.id,
      rowTextBefore: row.text,
      label,
      updateMeta,
      hasOnUpdateWithCategory: !!onUpdateWithCategory,
      hasOnUpdate: !!onUpdate,
      timestamp: Date.now()
    });

    if (onUpdateWithCategory) {
      console.log('🎯 [FactoryTaskCreator][CALLING_ON_UPDATE_WITH_CATEGORY]', {
        rowId: row.id,
        label,
        categoryType: 'taskTemplates',
        meta: updateMeta
      });
      (onUpdateWithCategory as any)(row, label, 'taskTemplates', updateMeta);
      console.log('🎯 [FactoryTaskCreator][AFTER_ON_UPDATE_WITH_CATEGORY]', {
        rowId: row.id,
        label,
        timestamp: Date.now()
      });
    } else {
      console.log('🎯 [FactoryTaskCreator][CALLING_ON_UPDATE]', {
        rowId: row.id,
        label,
        wasUndefined: (row as any)?.isUndefined
      });
      onUpdate({ ...row, isUndefined: false } as any, label);
      console.log('🎯 [FactoryTaskCreator][AFTER_ON_UPDATE]', {
        rowId: row.id,
        label,
        timestamp: Date.now()
      });
    }

    // Close row after saving text
    console.log('🎯 [FactoryTaskCreator][CLOSING_ROW]', {
      rowId: row.id,
      timestamp: Date.now()
    });
    onStateUpdate.setIsEditing(false);
    onStateUpdate.setShowIntellisense(false);
    onStateUpdate.setIntellisenseQuery('');
    onStateUpdate.closePicker();

    // Log final state after a brief delay
    setTimeout(() => {
      console.log('🎯 [FactoryTaskCreator][FINAL_STATE_CHECK]', {
        rowId: row.id,
        rowTextAfter: row.text,
        label,
        textsMatch: row.text === label,
        timestamp: Date.now()
      });
    }, 100);

    try {
      emitSidebarRefresh();
    } catch {
      // Ignore errors
    }
  }
}
