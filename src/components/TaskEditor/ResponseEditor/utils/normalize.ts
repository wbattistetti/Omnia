import type { Task } from '../../../../types/taskTypes';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a Task from viewer/catalog item to unified Task format.
 *
 * Model:
 * - Each escalation has its own dedicated Task (not shared)
 * - Task is complete (not lightweight reference)
 * - If task derives from template, templateId points to template Task
 */
export const createTask = (item: any): Task => {
  // Handle task objects from catalog entries
  const task = item?.task ?? item;

  // Extract templateId: if task has templateId, it's derived from template
  // Otherwise, it's a standalone task
  const templateId = task?.templateId || null;

  // Extract color from task or item
  const color = task?.color || item?.color;

  // Extract text (if already set)
  const text = typeof task?.text === 'string' ? task.text : undefined;

  // Extract label: prefer item.label (from TaskItem drag), then task.label
  const label = item?.label || task?.label || (typeof task?.label === 'object' ? (task.label.it || task.label.en || task.label) : undefined);

  // ✅ IMPORTANT: Each drop creates a NEW Task instance
  // If task has templateId, it derives from template (contracts inherited, steps copied)
  // Task ID must always be new for each drop

  // ✅ Use pre-generated id if provided (for idempotency), otherwise generate new one
  // The id identifies the specific task instance in the escalation
  const id = item?._generatedTaskId || uuidv4();

  // ✅ For backward compatibility, store old format in params
  // But Task is now complete, not a lightweight reference
  const params: Record<string, any> = {};
  if (task?.params) {
    Object.assign(params, task.params);
  }

  // Return complete Task object
  return {
    id,
    templateId, // null = standalone, GUID = derived from template
    text,
    label,
    color,
    params,
    // Copy other task properties if present
    ...(task?.mainData && { mainData: task.mainData }),
    ...(task?.stepPrompts && { stepPrompts: task.stepPrompts }),
    ...(task?.constraints && { constraints: task.constraints }),
    ...(task?.examples && { examples: task.examples }),
    ...(task?.intents && { intents: task.intents }),
    ...(task?.endpoint && { endpoint: task.endpoint }),
    ...(task?.method && { method: task.method }),
    createdAt: new Date(),
    updatedAt: new Date()
  };
};
