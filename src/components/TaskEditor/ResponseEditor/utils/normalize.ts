import type { Task } from '@types/taskTypes';
import { generateSafeGuid } from '@utils/idGenerator';

/** Factory palette entries use id as template reference when templateId is omitted */
function resolveTemplateIdFromCatalogTask(task: any): string | null {
  if (task?.templateId !== undefined && task?.templateId !== null) {
    return task.templateId;
  }
  const rawId = task?.id;
  if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
    return String(rawId);
  }
  return null;
}

/**
 * Create a Task from viewer/catalog item to unified Task format.
 *
 * Model:
 * - Each escalation has its own dedicated Task (not shared)
 * - Task is complete (not lightweight reference)
 * - If task derives from template, templateId points to template Task
 * - ✅ CRITICAL: type and templateId are ALWAYS present (required by compiler)
 */
export const createTask = (item: any): Task => {
  // Handle task objects from catalog entries
  const task = item?.task ?? item;

  const templateId = resolveTemplateIdFromCatalogTask(task);

  // ✅ CRITICAL: NO FALLBACK - type MUST be present
  if (task?.type === undefined || task?.type === null) {
    throw new Error(`[createTask] Task is missing required field 'type'. Item: ${JSON.stringify(item, null, 2)}`);
  }

  const type = task.type;  // ✅ NO FALLBACK - must be present

  // Extract color from task or item
  const color = task?.color || item?.color;

  // ❌ RIMOSSO: Extract text - task.text non deve esistere
  // Il modello corretto è: task contiene solo GUID, traduzione in translations[GUID]

  // Extract label: prefer item.label (from TaskItem drag), then task.label
  const label = item?.label || task?.label || (typeof task?.label === 'object' ? (task.label.it || task.label.en || task.label) : undefined);

  // ✅ IMPORTANT: Each drop creates a NEW Task instance
  // If task has templateId, it derives from template (contracts inherited, steps copied)
  // Task ID must always be new for each drop

  // ✅ Use pre-generated id if provided (for idempotency), otherwise generate new one
  // The id identifies the specific task instance in the escalation
  const id = item?._generatedTaskId || generateSafeGuid();

  // ✅ For backward compatibility, store old format in params
  // But Task is now complete, not a lightweight reference
  const params: Record<string, any> = {};
  if (task?.params) {
    Object.assign(params, task.params);
  }

  // Return complete Task object (no task.text — body via parameters + translations for SayMessage)
  return {
    id,
    type,  // ✅ CRITICAL: type always present (required by compiler)
    templateId, // null = standalone, GUID = derived from template
    label,
    color,
    params,
    // Copy other task properties if present
    // ❌ RIMOSSO: data, steps, constraints - vengono sempre dal template
    ...(task?.semanticValues && { semanticValues: task.semanticValues }),
    ...(task?.endpoint && { endpoint: task.endpoint }),
    ...(task?.method && { method: task.method }),
    createdAt: new Date(),
    updatedAt: new Date()
  };
};
