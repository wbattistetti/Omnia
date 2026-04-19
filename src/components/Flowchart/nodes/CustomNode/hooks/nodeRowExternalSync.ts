/**
 * Shallow equality for React Flow row lists (ids + stable JSON snapshot per row).
 * Used to avoid unnecessary local `nodeRows` sync when `displayRows` props are unchanged.
 */

import type { NodeRowData } from '../../../../../types/project';

export function rowListsShallowEqual(a: NodeRowData[], b: NodeRowData[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) {
      return false;
    }
    if (stableRowJson(a[i]) !== stableRowJson(b[i])) {
      return false;
    }
  }
  return true;
}

function stableRowJson(r: NodeRowData): string {
  return JSON.stringify({
    id: r.id,
    text: r.text ?? '',
    included: r.included,
    taskId: (r as { taskId?: string }).taskId,
    type: (r as { type?: unknown }).type,
    isUndefined: r.isUndefined,
    heuristics: r.heuristics,
    meta: r.meta,
    factoryId: r.factoryId,
  });
}
