/**
 * GUID-centric variable persistence (Phase 4–5).
 * Mongo stores minimal documents; labels live in project translations.
 */

import type { VariableInstance } from '../types/variableTypes';

export const UTTERANCE_VARIABLE_METADATA_TYPE = 'utterance' as const;
export const MANUAL_VARIABLE_METADATA_TYPE = 'manual' as const;
export const PROJECT_VARIABLE_METADATA_TYPE = 'project' as const;
export const SUBFLOW_VARIABLE_METADATA_TYPE = 'subflow' as const;
export const TASK_BOUND_VARIABLE_METADATA_TYPE = 'task_bound' as const;

export const VARIABLE_METADATA_TYPES = [
  UTTERANCE_VARIABLE_METADATA_TYPE,
  MANUAL_VARIABLE_METADATA_TYPE,
  PROJECT_VARIABLE_METADATA_TYPE,
  SUBFLOW_VARIABLE_METADATA_TYPE,
  TASK_BOUND_VARIABLE_METADATA_TYPE,
] as const;

export type VariableMetadataType = (typeof VARIABLE_METADATA_TYPES)[number];

export const MINIMAL_VARIABLE_METADATA_TYPE_SET = new Set<string>(VARIABLE_METADATA_TYPES);

export type UtteranceVariableMetadata = {
  type: typeof UTTERANCE_VARIABLE_METADATA_TYPE;
  [key: string]: unknown;
};

export function isUtteranceVariableMetadata(m: unknown): m is UtteranceVariableMetadata {
  return (
    typeof m === 'object' &&
    m !== null &&
    (m as { type?: string }).type === UTTERANCE_VARIABLE_METADATA_TYPE
  );
}

export function isMinimalVariableRow(row: { metadata?: { type?: string } }): boolean {
  const t = row.metadata?.type;
  return typeof t === 'string' && MINIMAL_VARIABLE_METADATA_TYPE_SET.has(t);
}

/**
 * Maps a minimal API document to an in-memory {@link VariableInstance}.
 * Utterance rows return null (hydration fills those).
 */
export function reconstructVariableInstanceFromMinimalDoc(doc: {
  id?: string;
  metadata?: {
    type?: string;
    flowCanvasId?: string;
    taskInstanceId?: string;
    dataPath?: string;
    scopeFlowId?: string;
    from?: string;
    to?: string;
  };
  from?: string;
  to?: string;
}): VariableInstance | null {
  const id = String(doc.id || '').trim();
  if (!id) return null;
  const m = doc.metadata || {};
  const t = m.type;
  if (t === UTTERANCE_VARIABLE_METADATA_TYPE) {
    return null;
  }
  if (t === PROJECT_VARIABLE_METADATA_TYPE) {
    return {
      id,
      varName: '',
      taskInstanceId: '',
      dataPath: '',
      scope: 'project',
    };
  }
  if (t === MANUAL_VARIABLE_METADATA_TYPE) {
    const fid = String(m.flowCanvasId || '').trim();
    return {
      id,
      varName: '',
      taskInstanceId: '',
      dataPath: '',
      scope: 'flow',
      scopeFlowId: fid,
    };
  }
  if (t === SUBFLOW_VARIABLE_METADATA_TYPE) {
    const from = String(doc.from || m.from || '').trim();
    const to = String(doc.to || m.to || '').trim();
    return {
      id,
      varName: '',
      taskInstanceId: '',
      dataPath: '',
      scope: 'project',
      bindingFrom: from,
      bindingTo: to,
    };
  }
  if (t === TASK_BOUND_VARIABLE_METADATA_TYPE) {
    return {
      id,
      varName: '',
      taskInstanceId: String(m.taskInstanceId || ''),
      dataPath: String(m.dataPath || ''),
      scope: 'flow',
      scopeFlowId: String(m.scopeFlowId || ''),
    };
  }
  return null;
}
