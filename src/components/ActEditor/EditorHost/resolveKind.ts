import type { EditorKind, ActMeta } from './types';

const map: Record<string, EditorKind> = {
  Message: 'message',
  DataRequest: 'ddt',
  ProblemClassification: 'ddt', // ✅ Cambiato da 'intent' a 'ddt' per usare ResponseEditor
  BackendCall: 'backend',
};

export function resolveEditorKind(act: ActMeta): EditorKind {
  const actType = act?.type || 'unknown';
  const resolvedKind = map[actType] ?? 'message';

  // ✅ Log per debug
  console.log('[resolveEditorKind]', {
    actType,
    resolvedKind,
    actId: act?.id,
    actLabel: act?.label,
    timestamp: Date.now()
  });

  return resolvedKind;
}


