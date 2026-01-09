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
 * Assumes taskId is always present (new model)
 * If missing, creates Task automatically
 *
 * @param row - NodeRowData row
 * @returns Task ID
 */
export function getTaskIdFromRow(row: NodeRowData): string | null {
  if (row.taskId) {
    return row.taskId;
  }

  // ✅ NON creare automaticamente il task - restituisci null se non esiste
  // LOGICA: Il task viene creato solo quando si apre ResponseEditor, dopo aver determinato il tipo con l'euristica
  const task = taskRepository.getTask(row.id);
  if (task) {
    // Task exists, just add taskId to row
    (row as any).taskId = task.id;
    return task.id;
  }

  // ✅ Task non esiste - restituisci null (verrà creato quando si apre ResponseEditor)
  return null;
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
 * ✅ DEPRECATED: Map actId to templateId (legacy - non più usato)
 * Ora usiamo type: TaskType enum invece di templateId semantico
 * @deprecated Usa taskIdToTaskType() da taskTypes.ts
 */
// ❌ RIMOSSO: mapActIdToTemplateId() - non più necessario
// templateId deve essere null o GUID, non stringhe semantiche

/**
 * Deriva il tipo di task dal templateId
 * @param templateId - Template ID (es. 'SayMessage', 'DataRequest', 'UNDEFINED')
 * @returns Tipo di task (es. 'Message', 'DataRequest', 'UNDEFINED')
 */
export function deriveTaskTypeFromTemplateId(templateId: string | undefined | null): string | undefined {
  if (!templateId) return undefined;

  const normalized = templateId.toLowerCase().trim();

  // Mapping inverso: templateId -> type
  if (normalized === 'getdata' || normalized === 'datarequest') return 'DataRequest';
  if (normalized === 'saymessage' || normalized === 'message') return 'Message';
  if (normalized === 'undefined') return 'UNDEFINED';
  if (normalized === 'classifyproblem' || normalized === 'problemclassification') return 'ProblemClassification';
  if (normalized === 'callbackend' || normalized === 'backendcall') return 'BackendCall';

  return undefined; // Tipo sconosciuto
}

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
        id: finalRowId,
        text: initialText || existingTask.text || '',
        included: true,
        taskId: existingTask.id,
        mode: 'Message' as const
      };
    }
  }

  // ✅ Create Task in TaskRepository with type (enum) and templateId (null = standalone)
  const task = taskRepository.createTask(
    taskType,                    // ✅ type: TaskType enum (obbligatorio)
    null,                        // ✅ templateId: null (standalone, non deriva da altri Task)
    taskType === TaskType.SayMessage ? { text: initialText } : undefined,  // Campi diretti
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
      ddt: (task.mainData && task.mainData.length > 0) ? {
        label: task.label,
        mainData: task.mainData,
        stepPrompts: task.stepPrompts,
        constraints: task.constraints,
        examples: task.examples
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
    // ✅ Spread DDT fields directly into task
    taskUpdates.label = data.ddt.label;
    taskUpdates.mainData = data.ddt.mainData;
    taskUpdates.stepPrompts = data.ddt.stepPrompts;
    taskUpdates.constraints = data.ddt.constraints;
    taskUpdates.examples = data.ddt.examples;
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
 * Enrich loaded rows with taskId
 * This is called after loading instances from database to ensure rows have taskId
 * Auto-creates Task if missing (migration helper)
 *
 * IMPORTANT: row.text is a descriptive label written by the user in the node row
 * It remains fixed and is NOT synchronized with task.text
 * task.text is the message content (saved in instance, edited in ResponseEditor)
 * These are completely separate - row.text is just a label for the flowchart
 *
 * @param rows - Array of NodeRowData rows to enrich
 * @returns Array of rows with taskId set (row.text remains unchanged)
 */
export function enrichRowsWithTaskId(rows: NodeRowData[]): NodeRowData[] {
  const result = rows.map(row => {
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
    // row.text remains unchanged - it's the user's label, not synced with task.text
    return {
      ...row,
      taskId: task.id
      // row.text stays as written by user - no synchronization
    };
  });

  return result;
}

