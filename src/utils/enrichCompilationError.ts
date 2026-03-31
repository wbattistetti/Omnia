/**
 * Normalizes backend compilation error payloads (camelCase / PascalCase) and attaches fixTarget for UI.
 */

import type { CompilationError, FixTarget } from '@components/FlowCompiler/types';

function pick(raw: Record<string, unknown>, key: string): unknown {
  if (key in raw) return raw[key];
  const pascal = key.length > 0 ? key[0].toUpperCase() + key.slice(1) : key;
  if (pascal in raw) return raw[pascal];
  return undefined;
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Builds fixTarget from category and ids (backend does not emit fixTarget).
 */
export function buildFixTargetForCompilationError(
  category: string,
  taskId: string,
  rowId: string | undefined,
  nodeId: string | undefined,
  edgeId: string | undefined
): FixTarget {
  const cat = category.trim();
  if (edgeId) {
    return { type: 'edge', edgeId };
  }
  if (
    cat === 'AmbiguousLink' ||
    cat === 'AmbiguousOutgoingLinks' ||
    cat === 'AmbiguousDuplicateEdgeLabels' ||
    cat === 'AmbiguousDuplicateConditionScript'
  ) {
    if (nodeId) return { type: 'node', nodeId };
  }
  if (rowId && taskId && taskId !== 'SYSTEM') {
    return { type: 'taskRow', taskId, rowId };
  }
  if (taskId && taskId !== 'SYSTEM') {
    return { type: 'task', taskId };
  }
  return { type: 'task', taskId: taskId || 'SYSTEM' };
}

/** Maps a raw error object from the VB compiler into a full CompilationError. */
export function enrichCompilationError(raw: Record<string, unknown>): CompilationError {
  const category = str(pick(raw, 'category'));
  const taskId = str(pick(raw, 'taskId'));
  const nodeId = str(pick(raw, 'nodeId')) || undefined;
  const rowId = str(pick(raw, 'rowId')) || undefined;
  const edgeId = str(pick(raw, 'edgeId')) || undefined;
  const message = str(pick(raw, 'message'));
  const sev = str(pick(raw, 'severity')).toLowerCase();
  const severity: CompilationError['severity'] =
    sev === 'warning' ? 'warning' : sev === 'hint' ? 'hint' : 'error';

  const fixTarget = buildFixTargetForCompilationError(category, taskId, rowId, nodeId, edgeId);

  return {
    taskId,
    nodeId,
    rowId,
    edgeId,
    message,
    severity,
    category: category || undefined,
    fixTarget,
    rowLabel: str(pick(raw, 'rowLabel')) || undefined,
    rowTaskRef: str(pick(raw, 'rowTaskRef')) || undefined,
    resolvedTaskId: str(pick(raw, 'resolvedTaskId')) || undefined,
    missingTaskRef: pick(raw, 'missingTaskRef') as boolean | undefined,
    invalidType: pick(raw, 'invalidType') as number | undefined,
    conditionId: str(pick(raw, 'conditionId')) || undefined,
    detailCode: str(pick(raw, 'detailCode')) || undefined,
    technicalDetail: str(pick(raw, 'technicalDetail')) || undefined,
    reason: str(pick(raw, 'reason')) || undefined,
    conflictsWith: Array.isArray(pick(raw, 'conflictsWith'))
      ? (pick(raw, 'conflictsWith') as unknown[]).map((x) => String(x))
      : undefined,
    entryNodeIds: Array.isArray(pick(raw, 'entryNodeIds'))
      ? (pick(raw, 'entryNodeIds') as unknown[]).map((x) => String(x))
      : undefined,
    siblingEdgeIds: Array.isArray(pick(raw, 'siblingEdgeIds'))
      ? (pick(raw, 'siblingEdgeIds') as unknown[]).map((x) => String(x))
      : undefined,
  };
}

export function enrichCompilationErrors(rawList: Array<Record<string, unknown>>): CompilationError[] {
  return rawList.map((r) => enrichCompilationError(r));
}
