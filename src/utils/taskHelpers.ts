import type { NodeRowData } from '../types/project';
import { taskRepository } from '../services/TaskRepository';
import { instanceRepository } from '../services/InstanceRepository';
import { generateId } from './idGenerator';

/**
 * Helper functions for Task/Instance migration
 * These functions provide backward-compatible access to Task IDs
 */

/**
 * Get Task ID from a row
 * Backward compatible: if taskId is not present, uses row.id as instanceId
 *
 * @param row - NodeRowData row
 * @returns Task ID (taskId if present, otherwise row.id)
 */
export function getTaskIdFromRow(row: NodeRowData): string {
  return row.taskId || row.id;
}

/**
 * Check if a row has been migrated to new Task model
 *
 * @param row - NodeRowData row
 * @returns true if row has taskId (migrated), false if using legacy (row.id = instanceId)
 */
export function isRowMigrated(row: NodeRowData): boolean {
  return !!row.taskId;
}

/**
 * Get instance ID from a row (for backward compatibility with InstanceRepository)
 *
 * @param row - NodeRowData row
 * @returns Instance ID (taskId if present, otherwise row.id)
 */
export function getInstanceIdFromRow(row: NodeRowData): string {
  // For now, taskId and instanceId are the same (1:1 relationship)
  // In the future, they might diverge, but for migration they're the same
  return row.taskId || row.id;
}

/**
 * Create a new row with Task (dual mode: Task + InstanceRepository)
 * This is the new way to create rows - creates both Task and InstanceRepository entry
 *
 * @param rowId - Topological ID for the row (if not provided, generates one)
 * @param action - Action ID (template ID) - defaults to 'Message'
 * @param initialText - Initial text for the row
 * @param projectId - Optional project ID
 * @returns NodeRowData with taskId set
 */
export function createRowWithTask(
  rowId?: string,
  action: string = 'Message',
  initialText: string = '',
  projectId?: string
): NodeRowData {
  const finalRowId = rowId || generateId();

  // Check if Task already exists (shouldn't happen, but safety check)
  if (taskRepository.hasTask(finalRowId)) {
    console.warn('[createRowWithTask] Task already exists, returning existing Task', {
      rowId: finalRowId,
      action
    });
    const existingTask = taskRepository.getTask(finalRowId);
    if (existingTask) {
      return {
        id: finalRowId,
        text: initialText || existingTask.value?.text || '',
        included: true,
        taskId: existingTask.id,
        mode: 'Message' as const
      };
    }
  }

  // Create Task in TaskRepository
  const task = taskRepository.createTask(
    action,
    action === 'Message' ? { text: initialText } : undefined,
    finalRowId, // Use same ID for Task and Instance (1:1 relationship)
    projectId
  );

  // Also create InstanceRepository entry for backward compatibility (same ID)
  // This ensures existing code that uses InstanceRepository continues to work
  if (!instanceRepository.getInstance(finalRowId)) {
    instanceRepository.createInstance(
      action, // actId
      [],     // initialIntents
      finalRowId, // instanceId (same as taskId)
      projectId
    );

    // If it's a Message, update the message text
    if (action === 'Message' && initialText) {
      instanceRepository.updateMessage(finalRowId, { text: initialText });
    }
  }

  // Return row with taskId set
  const newRow: NodeRowData = {
    id: finalRowId,
    text: initialText,
    included: true,
    taskId: task.id, // Set taskId to mark as migrated
    mode: 'Message' as const
  };

  console.log('[createRowWithTask] Created row with Task', {
    rowId: finalRowId,
    taskId: task.id,
    action,
    initialText: initialText.substring(0, 50),
    projectId
  });

  return newRow;
}

/**
 * Update row's Task when action changes (e.g., from Intellisense selection)
 *
 * @param row - NodeRowData row to update
 * @param newAction - New action ID (template ID)
 * @param projectId - Optional project ID
 */
export function updateRowTaskAction(
  row: NodeRowData,
  newAction: string,
  projectId?: string
): void {
  const taskId = getTaskIdFromRow(row);

  // Update Task's action
  taskRepository.updateTask(taskId, { action: newAction }, projectId);

  // Also update InstanceRepository for backward compatibility
  const instance = instanceRepository.getInstance(taskId);
  if (instance) {
    instanceRepository.updateInstance(taskId, { actId: newAction });
  } else {
    // If instance doesn't exist, create it
    instanceRepository.createInstance(newAction, [], taskId, projectId);
  }

  console.log('[updateRowTaskAction] Updated row Task action', {
    rowId: row.id,
    taskId,
    newAction,
    projectId
  });
}

/**
 * Get row data (message text, DDT, intents, etc.)
 * Dual mode: Uses Task if row has taskId, otherwise uses InstanceRepository
 *
 * @param row - NodeRowData row
 * @returns Row data object with message, ddt, intents, etc.
 */
export function getRowData(row: NodeRowData): {
  message?: { text: string };
  ddt?: any;
  intents?: any[];
  action?: string;
} {
  const taskId = getTaskIdFromRow(row);

  // If row has taskId, use TaskRepository
  if (row.taskId) {
    const task = taskRepository.getTask(taskId);
    if (task) {
      return {
        message: task.value?.text ? { text: task.value.text } : undefined,
        ddt: task.value?.ddt,
        intents: task.value?.intents,
        action: task.action
      };
    }
  }

  // Fallback to InstanceRepository (backward compatibility)
  const instance = instanceRepository.getInstance(taskId);
  if (instance) {
    return {
      message: instance.message,
      ddt: instance.ddt,
      intents: instance.problemIntents,
      action: instance.actId
    };
  }

  return {};
}

/**
 * Update row data (message text, DDT, intents, etc.)
 * Dual mode: Updates both Task and InstanceRepository
 *
 * @param row - NodeRowData row to update
 * @param data - Data to update (message, ddt, intents)
 * @param projectId - Optional project ID
 */
export function updateRowData(
  row: NodeRowData,
  data: {
    message?: { text: string };
    ddt?: any;
    intents?: any[];
  },
  projectId?: string
): void {
  const taskId = getTaskIdFromRow(row);

  // Update Task if row has taskId
  if (row.taskId) {
    const taskValue: Record<string, any> = {};
    if (data.message?.text !== undefined) {
      taskValue.text = data.message.text;
    }
    if (data.ddt !== undefined) {
      taskValue.ddt = data.ddt;
    }
    if (data.intents !== undefined) {
      taskValue.intents = data.intents;
    }

    if (Object.keys(taskValue).length > 0) {
      taskRepository.updateTaskValue(taskId, taskValue, projectId);
    }
  }

  // Also update InstanceRepository for backward compatibility
  if (data.message?.text !== undefined) {
    instanceRepository.updateMessage(taskId, data.message);
  }
  if (data.ddt !== undefined) {
    instanceRepository.updateDDT(taskId, data.ddt, projectId);
  }
  if (data.intents !== undefined) {
    instanceRepository.updateIntents(taskId, data.intents);
  }

  console.log('[updateRowData] Updated row data', {
    rowId: row.id,
    taskId,
    hasMessage: !!data.message,
    hasDDT: !!data.ddt,
    hasIntents: !!data.intents,
    projectId
  });
}

/**
 * Enrich loaded rows with taskId if Task exists
 * This is called after loading instances from database to ensure rows have taskId
 *
 * @param rows - Array of NodeRowData rows to enrich
 * @returns Array of rows with taskId set if Task exists
 */
export function enrichRowsWithTaskId(rows: NodeRowData[]): NodeRowData[] {
  return rows.map(row => {
    // If row already has taskId, keep it
    if (row.taskId) {
      return row;
    }

    // Check if Task exists for this row (by row.id)
    const task = taskRepository.getTask(row.id);
    if (task) {
      // Row has a corresponding Task, add taskId
      return {
        ...row,
        taskId: task.id
      };
    }

    // No Task found, return row as-is (backward compatibility)
    return row;
  });
}

