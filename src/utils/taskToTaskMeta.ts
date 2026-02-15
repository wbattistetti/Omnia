import type { TaskMeta } from '../components/TaskEditor/EditorHost/types';
import { TaskType } from '../types/taskTypes';
import type { Task } from '../types/taskTypes';

/**
 * Converte un Task completo in TaskMeta per usarlo con TaskEditor context.
 *
 * I Task completi hanno già il campo `type` (TaskType enum), quindi lo usiamo direttamente.
 * Se il Task non ha `type`, assume TaskType.UtteranceInterpretation come fallback (per oggetti transient DDT).
 */
export function taskToTaskMeta(task: Task | any): TaskMeta {
  if (!task) {
    throw new Error('Task cannot be null or undefined');
  }

  // ✅ Usa il type del Task se presente, altrimenti assume DataRequest (per transient DDT objects)
  const taskType = task.type !== undefined && task.type !== null
    ? task.type
    : TaskType.UtteranceInterpretation;

  return {
    id: task.id || task._id || `task_${Math.random().toString(36).slice(2)}`,
    type: taskType, // ✅ Usa il type del Task, non assume sempre DataRequest
    label: task.label || task._userLabel || 'Data',
    instanceId: task.instanceId || task.id || task._id,
    // ✅ Preserve wizard-related properties if present
    taskWizardMode: (task as any).taskWizardMode,
    contextualizationTemplateId: (task as any).contextualizationTemplateId,
    taskLabel: (task as any).taskLabel,
    needsTaskContextualization: (task as any).needsTaskContextualization,
    needsTaskBuilder: (task as any).needsTaskBuilder,
  };
}

