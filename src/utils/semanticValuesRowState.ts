/**
 * Draft-first semantic values for flowchart rows: pre-task storage in row.meta,
 * then task.semanticValues after TaskRepository materialization.
 */

import type { NodeRowData, RowMeta } from '@types/project';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, type SemanticValue } from '@types/taskTypes';

export const SEMANTIC_DRAFT_FLUSH_EVENT = 'flowchart:semanticDraftFlushed';

export type SemanticValuesNormalized = {
  items: SemanticValue[];
  /** True when domain is open (null / unset) vs closed ([] or non-empty). */
  isOpenDomain: boolean;
};

function pruneMetaAfterRemovingDraft(meta: RowMeta | undefined): RowMeta | undefined {
  if (!meta) return undefined;
  const { semanticValuesDraft: _removed, ...rest } = meta;
  return Object.keys(rest).length ? (rest as RowMeta) : undefined;
}

/**
 * Removes semanticValuesDraft from row.meta; drops meta when empty.
 */
export function pruneSemanticDraftFromRow(row: NodeRowData): NodeRowData {
  if (row.meta?.semanticValuesDraft === undefined) return row;
  const nextMeta = pruneMetaAfterRemovingDraft(row.meta);
  if (!nextMeta) {
    const { meta: _m, ...rest } = row;
    return { ...rest };
  }
  return { ...row, meta: nextMeta };
}

/**
 * Applies semanticValuesDraft to row (immutable). Pass null for open domain.
 */
export function applySemanticValuesDraftToRow(
  row: NodeRowData,
  values: SemanticValue[] | null
): NodeRowData {
  const nextMeta: RowMeta = { ...row.meta, semanticValuesDraft: values };
  return { ...row, meta: nextMeta };
}

/**
 * Reads semantic values for UI: task wins when present, else row.meta draft.
 */
export function getSemanticValuesForRow(row: NodeRowData): SemanticValuesNormalized {
  const task = taskRepository.getTask(row.id);
  if (task) {
    const v = task.semanticValues;
    if (v === undefined) {
      return { items: [], isOpenDomain: true };
    }
    if (v === null) {
      return { items: [], isOpenDomain: true };
    }
    return { items: v, isOpenDomain: false };
  }

  const d = row.meta?.semanticValuesDraft;
  if (d === undefined) {
    return { items: [], isOpenDomain: true };
  }
  if (d === null) {
    return { items: [], isOpenDomain: true };
  }
  return { items: d, isOpenDomain: false };
}

/**
 * Count of values in closed domain (for toolbar badge).
 */
export function getSemanticValuesCountForRow(row: NodeRowData): number {
  const { items, isOpenDomain } = getSemanticValuesForRow(row);
  if (isOpenDomain) return 0;
  return items.length;
}

/**
 * Persists semantic values: task.semanticValues if task exists, else row.meta.semanticValuesDraft.
 */
export function setSemanticValuesForRow(
  rowId: string,
  values: SemanticValue[] | null,
  updateNodeRows: (mutate: (rows: NodeRowData[]) => NodeRowData[]) => void
): boolean {
  const task = taskRepository.getTask(rowId);
  if (task) {
    const ok = taskRepository.updateTask(rowId, { semanticValues: values });
    if (!ok) {
      console.error('[semanticValuesRowState] updateTask failed', { rowId });
      return false;
    }
    return true;
  }

  updateNodeRows((rows) =>
    rows.map((r) => (r.id === rowId ? applySemanticValuesDraftToRow(r, values) : r))
  );
  return true;
}

/**
 * Functional update: reads latest row from graph for pre-task draft (avoids stale row.meta).
 */
export function mutateSemanticValuesForRow(
  rowId: string,
  updateNodeRows: (mutate: (rows: NodeRowData[]) => NodeRowData[]) => void,
  mutate: (prevItems: SemanticValue[]) => SemanticValue[] | null
): boolean {
  const task = taskRepository.getTask(rowId);
  if (task) {
    const v = task.semanticValues;
    const prevItems = v == null || !Array.isArray(v) ? [] : v;
    const next = mutate(prevItems);
    const ok = taskRepository.updateTask(rowId, { semanticValues: next });
    if (!ok) {
      console.error('[semanticValuesRowState] updateTask failed', { rowId });
      return false;
    }
    return true;
  }

  updateNodeRows((rows) =>
    rows.map((r) => {
      if (r.id !== rowId) return r;
      const prevItems = getSemanticValuesForRow(r).items;
      const next = mutate(prevItems);
      return applySemanticValuesDraftToRow(r, next);
    })
  );
  return true;
}

export function emitSemanticDraftFlushed(rowId: string, nextRow: NodeRowData): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SEMANTIC_DRAFT_FLUSH_EVENT, {
      detail: { rowId, nextRow },
    })
  );
}

/**
 * After task creation: copy draft into task.semanticValues and remove draft from row (emit graph update).
 */
export function flushSemanticDraftToTaskOnTaskCreated(row: NodeRowData, taskId: string): NodeRowData | null {
  const draft = row.meta?.semanticValuesDraft;
  if (draft === undefined) {
    return null;
  }

  const task = taskRepository.getTask(taskId);
  if (!task) {
    throw new Error(`[flushSemanticDraftToTaskOnTaskCreated] Task missing: ${taskId}`);
  }

  if (task.type !== TaskType.UtteranceInterpretation) {
    console.warn('[semanticValuesRowState] Clearing draft — task is not UtteranceInterpretation', {
      taskId,
      type: task.type,
    });
    const nextRow = pruneSemanticDraftFromRow(row);
    emitSemanticDraftFlushed(row.id, nextRow);
    return nextRow;
  }

  const ok = taskRepository.updateTask(taskId, { semanticValues: draft });
  if (!ok) {
    throw new Error(`[flushSemanticDraftToTaskOnTaskCreated] updateTask failed: ${taskId}`);
  }

  const nextRow = pruneSemanticDraftFromRow(row);
  emitSemanticDraftFlushed(row.id, nextRow);
  return nextRow;
}

/**
 * If a task exists but row still has a draft (reload / partial save), drop draft — task wins.
 */
export function reconcileRowMetaWithExistingTask(row: NodeRowData): NodeRowData | null {
  if (!taskRepository.hasTask(row.id)) return null;
  if (row.meta?.semanticValuesDraft === undefined) return null;
  return pruneSemanticDraftFromRow(row);
}
