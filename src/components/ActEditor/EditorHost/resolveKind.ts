import type { EditorKind, ActMeta } from './types';

const map: Record<string, EditorKind> = {
  Message: 'message',
  DataRequest: 'ddt',
  ProblemClassification: 'ddt', // ✅ Cambiato da 'intent' a 'ddt' per usare ResponseEditor
  BackendCall: 'backend',
  Negotiation: 'ddt', // ✅ Usa ResponseEditor per Negotiation
  Summarizer: 'ddt', // ✅ Usa ResponseEditor per Summarizer
};

import { TaskType, getEditorFromTaskType } from '../../../types/taskTypes';

/**
 * Converte ActType string (es. "DataRequest", "Message") in TaskType enum
 */
function actTypeToTaskType(actType: string): TaskType {
  const normalized = (actType || '').toLowerCase().trim();

  switch (normalized) {
    case 'message':
      return TaskType.SayMessage;
    case 'datarequest':
    case 'askquestion':
      return TaskType.GetData;
    case 'problemclassification':
    case 'classifyproblem':
      return TaskType.ClassifyProblem;
    case 'backendcall':
    case 'callbackend':
      return TaskType.BackendCall;
    case 'closesession':
      return TaskType.CloseSession;
    case 'transfer':
      return TaskType.Transfer;
    default:
      return TaskType.SayMessage; // Default
  }
}

export function resolveEditorKind(act: ActMeta): EditorKind {
  const actType = act?.type || 'unknown';

  // ✅ Se tipo è UNDEFINED ma c'è un label, apri ResponseEditor per permettere inferenza tipo da template DDT
  if (actType === 'UNDEFINED' && act?.label && act.label.trim().length > 0) {
    return 'ddt'; // Apri ResponseEditor per permettere a tryLocalPatternMatch di inferire il tipo
  }

  // ✅ REFACTORED: Usa TaskType enum e getEditorFromTaskType() invece di map statico
  const taskType = actTypeToTaskType(actType);
  const editorKind = getEditorFromTaskType(taskType);

  return editorKind as EditorKind;
}


