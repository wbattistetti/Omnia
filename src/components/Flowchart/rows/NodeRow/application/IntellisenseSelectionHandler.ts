// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType, taskIdToTaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { createRowWithTask, updateRowTaskType, getTemplateId } from '@utils/taskHelpers';
import { generateId } from '@utils/idGenerator';
import type { Row } from '@types/NodeRowTypes';
import type { IntellisenseItem } from '../../../Intellisense/IntellisenseTypes';

export interface IntellisenseSelectionHandlerDependencies {
  row: Row;
  item: IntellisenseItem;
  getProjectId?: () => string | undefined;
  getCurrentProjectId?: () => string | undefined;
}

export interface IntellisenseSelectionResult {
  success: boolean;
  taskId?: string;
  instanceId?: string;
  updateData?: {
    factoryId?: string;
    type?: string;
    mode?: string;
    userActs?: any[];
    categoryType?: string;
    instanceId?: string;
    taskId?: string;
  };
  error?: Error;
}

/**
 * Service to handle intellisense item selection and task creation.
 * Extracted from NodeRow.tsx to separate business logic from UI concerns.
 */
export class IntellisenseSelectionHandler {
  private row: Row;
  private item: IntellisenseItem;
  private getProjectId?: () => string | undefined;
  private getCurrentProjectId?: () => string | undefined;

  constructor(dependencies: IntellisenseSelectionHandlerDependencies) {
    this.row = dependencies.row;
    this.item = dependencies.item;
    this.getProjectId = dependencies.getProjectId;
    this.getCurrentProjectId = dependencies.getCurrentProjectId;
  }

  /**
   * Handles the selection of an intellisense item and creates/updates the associated task.
   * Returns the data needed to update the row.
   */
  public async handleSelection(): Promise<IntellisenseSelectionResult> {
    try {
      // Get project ID
      let projectId: string | undefined = undefined;
      try {
        projectId = this.getCurrentProjectId?.() || this.getProjectId?.() || undefined;
      } catch {
        // Ignore errors getting project ID
      }

      // Prepare base update data
      const baseUpdateData: any = {
        factoryId: this.item.factoryId,
        type: (this.item as any)?.type,
        mode: (this.item as any)?.mode,
        userActs: this.item.userActs,
        categoryType: this.item.categoryType,
      };

      // Create task for taskTemplates category
      if (projectId && this.item.id && this.item.categoryType === 'taskTemplates') {
        const chosenType = (this.item as any)?.type ?? TaskType.UNDEFINED;
        const taskId = this.row.id || generateId();

        // Create task in taskRepository
        const task = taskRepository.createTask(
          chosenType,
          this.item.id || null,
          undefined,
          taskId,
          projectId
        );

        if (task) {
          baseUpdateData.instanceId = task.id;
          baseUpdateData.type = chosenType;
        }
      }

      // Handle ProblemClassification special case
      const problemClassificationResult = await this.handleProblemClassification(
        projectId
      );

      if (problemClassificationResult.success && problemClassificationResult.updateData) {
        // Merge ProblemClassification update data
        Object.assign(baseUpdateData, problemClassificationResult.updateData);
      }

      return {
        success: true,
        taskId: baseUpdateData.instanceId || this.row.id,
        instanceId: baseUpdateData.instanceId || this.row.id,
        updateData: baseUpdateData,
      };
    } catch (error) {
      console.error('[IntellisenseSelectionHandler] Error handling selection:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Handles special case for ProblemClassification tasks.
   * Creates task with intents if needed.
   */
  private async handleProblemClassification(
    projectId: string | undefined
  ): Promise<IntellisenseSelectionResult> {
    try {
      const itemCategoryType = (this.item as any)?.categoryType;
      const itemType = (this.item as any)?.type;

      // Get row type from existing task
      const rowTask = taskRepository.getTask(this.row.id);
      const templateIdToTaskType: Record<string, string> = {
        SayMessage: 'Message',
        UtteranceInterpretation: 'UtteranceInterpretation',
        ClassifyProblem: 'ProblemClassification',
        callBackend: 'BackendCall',
      };
      const rowType = rowTask
        ? templateIdToTaskType[getTemplateId(rowTask)] ?? getTemplateId(rowTask)
        : undefined;

      const isProblemClassification =
        itemCategoryType === 'taskTemplates' &&
        (itemType === 'ProblemClassification' || rowType === 'ProblemClassification');

      if (!isProblemClassification) {
        return { success: true };
      }

      // Use row.id as instanceId
      const instanceIdToUse = this.row.id ?? generateId();
      const taskTypeToUse = this.item.type ?? 'ProblemClassification';

      // Load initial intents from existing task if available
      let initialIntents: any[] = [];
      try {
        const task = taskRepository.getTask(instanceIdToUse);
        if (task?.intents) {
          initialIntents = task.intents;
        }
      } catch (err) {
        console.warn('[IntellisenseSelectionHandler] Could not load template intents:', err);
      }

      // Create or update task
      const instanceId = this.row.id ?? generateId();
      const taskTypeEnum =
        typeof taskTypeToUse === 'string'
          ? taskIdToTaskType(taskTypeToUse)
          : taskTypeToUse;

      // Check if task exists in repository (row.id === task.id ALWAYS)
      const existingTask = taskRepository.getTask(this.row.id);
      if (!existingTask) {
        // Create Task for this row
        const task = createRowWithTask(instanceId, taskTypeEnum, this.row.text ?? '', projectId);
        // Update Task with intents if ProblemClassification
        if (initialIntents.length > 0) {
          taskRepository.updateTask(task.id, { intents: initialIntents }, projectId);
        }
      } else {
        // Update Task type
        updateRowTaskType(this.row, taskTypeEnum, projectId);
      }

      return {
        success: true,
        taskId: instanceId,
        instanceId: instanceId,
        updateData: {
          instanceId: instanceId,
          taskId: this.row.id, // ✅ row.id === task.id ALWAYS
          type: (this.item as any)?.type,
          mode: (this.item as any)?.mode,
        },
      };
    } catch (error) {
      console.error('[IntellisenseSelectionHandler] Error handling ProblemClassification:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
