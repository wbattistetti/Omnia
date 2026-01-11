import type { EditorKind, TaskMeta } from './types'; // ✅ RINOMINATO: ActMeta → TaskMeta
import { TaskType, getEditorFromTaskType } from '../../../types/taskTypes';

export function resolveEditorKind(task: TaskMeta): EditorKind { // ✅ RINOMINATO: act → task
  // ✅ FIX CRITICO: Usa ?? invece di || per gestire correttamente 0 (SayMessage è falsy ma valido)
  const taskType = task?.type ?? TaskType.UNDEFINED; // ✅ Usa direttamente task.type (TaskType enum)

  // ✅ Se tipo è UNDEFINED ma c'è un label, apri ResponseEditor per permettere inferenza tipo da template DDT
  if (taskType === TaskType.UNDEFINED && task?.label && task.label.trim().length > 0) {
    return 'ddt'; // Apri ResponseEditor per permettere a tryLocalPatternMatch di inferire il tipo
  }

  // ✅ Usa direttamente task.type (TaskType enum) invece di convertire da stringa
  const editorKind = getEditorFromTaskType(taskType);

  // ✅ Mapping: 'problem' → 'intent' (IntentEditor gestisce ClassifyProblem)
  if (editorKind === 'problem') {
    return 'intent';
  }

  // ✅ Fallback: se editorKind non è nel tipo EditorKind, usa 'simple'
  if (editorKind !== 'message' && editorKind !== 'ddt' && editorKind !== 'intent' && editorKind !== 'backend' && editorKind !== 'aiagent' && editorKind !== 'summarizer' && editorKind !== 'negotiation') {
    return 'simple';
  }

  return editorKind as EditorKind;
}


