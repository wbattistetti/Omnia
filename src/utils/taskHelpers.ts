import type { NodeRowData } from '../types/project';
import type { Task, TaskInstance } from '../types/taskTypes';
import { TaskType, taskIdToTaskType } from '../types/taskTypes'; // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType
import { taskRepository } from '../services/TaskRepository';
// FASE 4: InstanceRepository import removed - TaskRepository handles synchronization internally
import { generateId } from './idGenerator';

/**
 * Helper functions for Task/Instance migration
 * These functions provide backward-compatible access to Task IDs
 */

// ============================================================================
// ✅ MIGRATION HELPERS: Universal helpers for Task → TaskInstance migration
// ============================================================================

/**
 * ✅ HELPER UNIVERSALE: Usa SEMPRE questo per ottenere templateId
 * Garantisce uniformità durante la migrazione
 *
 * Priority: templateId (new) > action (legacy)
 *
 * @param task - Task or TaskInstance
 * @returns Template ID (string | null) - null per task standalone
 */
export function getTemplateId(task: Task | TaskInstance | null | undefined): string | null {
  if (!task) {
    return null;
  }

  // ✅ templateId può essere null per task standalone
  if ('templateId' in task) {
    return task.templateId ?? null;
  }

  // Se non ha templateId, restituisci null (task standalone)
  return null;
}

/**
 * ✅ VALIDATION: Verifica che il Task sia valido
 *
 * @param task - Task or TaskInstance to validate
 * @throws Error if task is invalid
 */
export function validateTask(task: Task | TaskInstance | null | undefined): void {
  if (!task) {
    throw new Error('Task is null or undefined');
  }

  if (!task.id || task.id.trim() === '') {
    throw new Error('Task has invalid id');
  }

  // ✅ templateId può essere null per task standalone - non è un errore
  // validateTask verifica solo che il task abbia un id valido
}

/**
 * ✅ HELPER: Normalizza Task a TaskInstance
 * Assicura che templateId sia presente (può essere null per task standalone)
 *
 * @param task - Task to normalize
 * @returns TaskInstance with templateId (null se standalone)
 */
export function normalizeTask(task: Task): TaskInstance {
  validateTask(task);

  const templateId = getTemplateId(task);

  return {
    id: task.id,
    templateId: templateId ?? null, // ✅ null è valido per task standalone
    // ✅ Campi diretti (niente wrapper value) - copia tutti i campi tranne id, templateId, createdAt, updatedAt
    ...Object.fromEntries(
      Object.entries(task).filter(([key]) =>
        !['id', 'templateId', 'createdAt', 'updatedAt'].includes(key)
      )
    ),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

/**
 * Get Task ID from a row
 * ALWAYS returns row.id (task.id === row.id when task exists)
 *
 * @param row - NodeRowData row
 * @returns Task ID (row.id) or null if task doesn't exist
 */
export function getTaskIdFromRow(row: NodeRowData): string | null {
  // ✅ CRITICAL: task.id === row.id ALWAYS
  // Check if task exists - if yes, return row.id, otherwise null
  const task = taskRepository.getTask(row.id);
  return task ? row.id : null;
}

/**
 * Check if a row has a task associated
 * ALWAYS uses row.id to check (task.id === row.id when task exists)
 *
 * @param row - NodeRowData row
 * @returns true if task exists, false otherwise
 */
export function isRowMigrated(row: NodeRowData): boolean {
  // ✅ CRITICAL: task.id === row.id ALWAYS
  return taskRepository.hasTask(row.id);
}

/**
 * Get instance ID from a row
 * ALWAYS returns row.id (task.id === row.id when task exists)
 *
 * @param row - NodeRowData row
 * @returns Instance ID (always row.id)
 */
export function getInstanceIdFromRow(row: NodeRowData): string {
  // ✅ CRITICAL: task.id === row.id ALWAYS
  return row.id;
}

/**
 * ✅ DEPRECATED: Map actId to templateId (legacy - non più usato)
 * Ora usiamo type: TaskType enum invece di templateId semantico
 * @deprecated Usa taskIdToTaskType() da taskTypes.ts
 */
// ❌ RIMOSSO: mapActIdToTemplateId() - non più necessario
// templateId deve essere null o GUID, non stringhe semantiche

// ✅ REMOVED: deriveTaskTypeFromTemplateId - DEPRECATED
// Usa taskIdToTaskType() da taskTypes.ts invece

/**
 * Create a new row with Task (dual mode: Task + InstanceRepository)
 * This is the new way to create rows - creates both Task and InstanceRepository entry
 *
 * @param rowId - Topological ID for the row (if not provided, generates one)
 * @param taskType - TaskType enum (defaults to SayMessage)
 * @param initialText - Initial text for the row
 * @param projectId - Optional project ID
 * @returns NodeRowData with taskId set
 */
export function createRowWithTask(
  rowId?: string,
  taskType: TaskType = TaskType.SayMessage, // ✅ TaskType enum invece di stringa action
  initialText: string = '',
  projectId?: string
): NodeRowData {
  const finalRowId = rowId || generateId();

  // Check if Task already exists (shouldn't happen, but safety check)
  if (taskRepository.hasTask(finalRowId)) {
    const existingTask = taskRepository.getTask(finalRowId);
    if (existingTask) {
      return {
        id: finalRowId,  // ALWAYS equals task.id
        text: initialText || existingTask.text || '',
        included: true,
        mode: 'Message' as const
      };
    }
  }

  // ✅ Create Task in TaskRepository with type (enum) and templateId (null = standalone)
  // ✅ CRITICAL: task.id === row.id ALWAYS
  const task = taskRepository.createTask(
    taskType,                    // ✅ type: TaskType enum (obbligatorio)
    null,                        // ✅ templateId: null (standalone, non deriva da altri Task)
    taskType === TaskType.SayMessage ? { text: initialText } : undefined,  // Campi diretti
    finalRowId, // ✅ CRITICAL: Use row.id as task.id (task.id === row.id ALWAYS)
    projectId
  );

  // FASE 4: TaskRepository.createTask already creates InstanceRepository entry internally
  // No need to create it separately - TaskRepository handles synchronization

  // Return row (task.id === row.id ALWAYS, no need for taskId field)
  const newRow: NodeRowData = {
    id: finalRowId,  // ALWAYS equals task.id
    text: initialText,
    included: true,
    mode: 'Message' as const
  };

  return newRow;
}

/**
 * Update row's Task type
 * ✅ RINOMINATO: updateRowTaskAction → updateRowTaskType
 *
 * @param row - NodeRowData row to update
 * @param taskType - TaskType enum (comportamento del task)
 * @param projectId - Optional project ID
 */
export function updateRowTaskType( // ✅ RINOMINATO: updateRowTaskAction → updateRowTaskType
  row: NodeRowData,
  taskType: TaskType, // ✅ TaskType enum invece di stringa
  projectId?: string
): void {
  const taskId = getTaskIdFromRow(row);

  // ✅ Se il task non esiste, non fare nulla (verrà creato quando si apre ResponseEditor)
  if (!taskId) {
    console.warn('[updateRowTaskType] Task non esiste ancora - verrà creato quando si apre ResponseEditor');
    return;
  }

  // ✅ Aggiorna direttamente il type (enum) e templateId (null = standalone)
  taskRepository.updateTask(taskId, {
    type: taskType,
    templateId: null // ✅ Standalone task, no template reference
  }, projectId);
}

/**
 * Get row data (message text, DDT, intents, etc.)
 * Uses TaskRepository (new model)
 * ✅ MIGRATION: Uses getTemplateId() helper
 *
 * @param row - NodeRowData row
 * @returns Row data object with message, ddt, intents, etc.
 */
export function getRowData(row: NodeRowData): {
  message?: { text: string };
  ddt?: any;
  intents?: any[];
  // ❌ RIMOSSO: action field (legacy, non più necessario)
} {
  const taskId = getTaskIdFromRow(row);
  const task = taskRepository.getTask(taskId);

  if (task) {
    return {
      message: task.text ? { text: task.text } : undefined,
      ddt: (task.data && task.data.length > 0) ? {
        label: task.label,
        data: task.data,
        steps: task.steps,
        constraints: task.constraints,
      } : undefined,
      intents: task.intents
      // ❌ RIMOSSO: action field (legacy)
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

  // ✅ Se il task non esiste, non fare nulla (verrà creato quando si apre ResponseEditor)
  if (!taskId) {
    console.warn('[updateRowData] Task non esiste ancora - verrà creato quando si apre ResponseEditor');
    return;
  }

  // ✅ Update task con campi direttamente (niente wrapper value)
  const taskUpdates: Record<string, any> = {};
  if (data.message?.text !== undefined) {
    taskUpdates.text = data.message.text;
  }
  if (data.ddt !== undefined) {
    // ✅ Solo label override (data, steps, constraints, examples vengono dal template)
    taskUpdates.label = data.ddt.label;
    // ❌ RIMOSSO: data, steps, constraints, examples - vengono sempre dal template
  }
  if (data.intents !== undefined) {
    taskUpdates.intents = data.intents;
  }

  if (Object.keys(taskUpdates).length > 0) {
    taskRepository.updateTask(taskId, taskUpdates, projectId);
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
 * ✅ DEPRECATED: enrichRowsWithTaskId - NO LONGER NEEDED
 *
 * This function is deprecated because row.taskId no longer exists.
 * The rule is: task.id === row.id ALWAYS (when task exists)
 *
 * To check if a row has a task, use: taskRepository.hasTask(row.id)
 * To get the task, use: taskRepository.getTask(row.id)
 *
 * @deprecated Use taskRepository.hasTask(row.id) or taskRepository.getTask(row.id) instead
 */
export function enrichRowsWithTaskId(rows: NodeRowData[]): NodeRowData[] {
  // ✅ CRITICAL: task.id === row.id ALWAYS (when task exists)
  // No need to enrich - just return rows as-is
  // If you need to check if a row has a task, use taskRepository.hasTask(row.id)
  return rows;
}

