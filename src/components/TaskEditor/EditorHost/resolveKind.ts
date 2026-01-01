import type { EditorKind, TaskMeta } from './types'; // ✅ RINOMINATO: ActMeta → TaskMeta
import { TaskType, getEditorFromTaskType } from '../../../types/taskTypes';

export function resolveEditorKind(task: TaskMeta): EditorKind { // ✅ RINOMINATO: act → task
  const taskType = task?.type || TaskType.UNDEFINED; // ✅ Usa direttamente task.type (TaskType enum)

  // ✅ Se tipo è UNDEFINED ma c'è un label, apri ResponseEditor per permettere inferenza tipo da template DDT
  if (taskType === TaskType.UNDEFINED && task?.label && task.label.trim().length > 0) {
    return 'ddt'; // Apri ResponseEditor per permettere a tryLocalPatternMatch di inferire il tipo
  }

  // ✅ Usa direttamente task.type (TaskType enum) invece di convertire da stringa
  const editorKind = getEditorFromTaskType(taskType);

  return editorKind as EditorKind;
}


