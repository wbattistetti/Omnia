import type { NodeRowData } from '../types/project';
import { taskRepository } from '../services/TaskRepository';
// FASE 4: InstanceRepository import removed - TaskRepository handles synchronization internally
import { generateId } from './idGenerator';

/**
 * Helper functions for Task/Instance migration
 * These functions provide backward-compatible access to Task IDs
 */

/**
 * Get Task ID from a row
 * Assumes taskId is always present (new model)
 * If missing, creates Task automatically
 *
 * @param row - NodeRowData row
 * @returns Task ID
 */
export function getTaskIdFromRow(row: NodeRowData): string {
  if (row.taskId) {
    return row.taskId;
  }

  // Auto-create Task if missing (migration helper)
  console.warn('[getTaskIdFromRow] Row missing taskId, creating Task automatically', { rowId: row.id });
  const task = taskRepository.getTask(row.id);
  if (task) {
    // Task exists, just add taskId to row
    (row as any).taskId = task.id;
    return task.id;
  }

  // Create Task for row without taskId
  const newTask = taskRepository.createTask('Message', row.text ? { text: row.text } : undefined, row.id);
  (row as any).taskId = newTask.id;
  return newTask.id;
}

/**
 * Check if a row has been migrated to new Task model
 *
 * @param row - NodeRowData row
 * @returns true if row has taskId, false if using row.id as instanceId
 */
export function isRowMigrated(row: NodeRowData): boolean {
  return !!row.taskId;
}

/**
 * Get instance ID from a row
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

  // FASE 4: TaskRepository.createTask already creates InstanceRepository entry internally
  // No need to create it separately - TaskRepository handles synchronization

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

  // FASE 4: TaskRepository.updateTask already updates InstanceRepository internally
  // No need to update it separately - TaskRepository handles synchronization

  console.log('[updateRowTaskAction] Updated row Task action', {
    rowId: row.id,
    taskId,
    newAction,
    projectId
  });
}

/**
 * Get row data (message text, DDT, intents, etc.)
 * Uses TaskRepository (new model)
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
  const task = taskRepository.getTask(taskId);

  if (task) {
    return {
      message: task.value?.text ? { text: task.value.text } : undefined,
      ddt: task.value?.ddt,
      intents: task.value?.intents,
      action: task.action
    };
  }

  return {};
}

/**
 * Update row data (message text, DDT, intents, etc.)
 * Uses TaskRepository (new model)
 * Note: TaskRepository internally updates InstanceRepository for compatibility
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
 * Enrich loaded rows with taskId
 * This is called after loading instances from database to ensure rows have taskId
 * Auto-creates Task if missing (migration helper)
 *
 * IMPORTANT: row.text is a descriptive label written by the user in the node row
 * It remains fixed and is NOT synchronized with task.value.text
 * task.value.text is the message content (saved in instance, edited in ResponseEditor)
 * These are completely separate - row.text is just a label for the flowchart
 *
 * @param rows - Array of NodeRowData rows to enrich
 * @returns Array of rows with taskId set (row.text remains unchanged)
 */
export function enrichRowsWithTaskId(rows: NodeRowData[]): NodeRowData[] {
  return rows.map(row => {
    // If row already has taskId, just return it (row.text stays as is)
    if (row.taskId) {
      return row;
    }

    // Check if Task exists for this row (by row.id)
    // Rule: row.id === task.id
    // If task doesn't exist yet, return row without taskId - task will be created later when user clicks the gear icon
    const task = taskRepository.getTask(row.id);
    if (!task) {
      // Task doesn't exist yet - it will be created when user clicks the gear icon
      // Return row without taskId - task will be created later with same ID as row.id
      return row;
    }

    // Row has a corresponding Task, add taskId
    // row.text remains unchanged - it's the user's label, not synced with task.value.text
    return {
      ...row,
      taskId: task.id
      // row.text stays as written by user - no synchronization
    };
  });
}

