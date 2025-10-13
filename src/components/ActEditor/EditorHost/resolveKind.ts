import type { EditorKind, ActMeta } from './types';

const map: Record<string, EditorKind> = {
  Message: 'message',
  DataRequest: 'ddt',
  ProblemClassification: 'intent',
  BackendCall: 'backend',
};

export function resolveEditorKind(act: ActMeta): EditorKind {
  return map[act.type] ?? 'message';
}


