import type { EditorKind, ActMeta } from './types';

const map: Record<string, EditorKind> = {
  Message: 'message',
  DataRequest: 'ddt',
  ProblemClassification: 'ddt', // ✅ Cambiato da 'intent' a 'ddt' per usare ResponseEditor
  BackendCall: 'backend',
  Negotiation: 'ddt', // ✅ Usa ResponseEditor per Negotiation
  Summarizer: 'ddt', // ✅ Usa ResponseEditor per Summarizer
};

export function resolveEditorKind(act: ActMeta): EditorKind {
  const actType = act?.type || 'unknown';
  const resolvedKind = map[actType] ?? 'message';
  return resolvedKind;
}


