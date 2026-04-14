/**
 * Canonical step: GUID-shaped strings embedded in the task payload (structured walk; no JSON.stringify in caller).
 */

import type { ObjectGuid } from '../types';
import type { TaskRepositoryAdapter } from '../adapters/taskRepositoryAdapter';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function walkCollectGuids(x: unknown, out: Set<string>, depth: number): void {
  if (depth > 48 || x == null) return;
  if (typeof x === 'string') {
    const s = x.trim();
    if (UUID_RE.test(s)) out.add(s);
    return;
  }
  if (Array.isArray(x)) {
    for (const e of x) walkCollectGuids(e, out, depth + 1);
    return;
  }
  if (typeof x === 'object') {
    for (const v of Object.values(x as Record<string, unknown>)) walkCollectGuids(v, out, depth + 1);
  }
}

export type GetTaskObjectGuidsInput = {
  taskInstanceId: string;
  taskRepository: TaskRepositoryAdapter;
};

/**
 * Extracts UUID-like references from the persisted task object.
 */
export function GetTaskObjectGuids(input: GetTaskObjectGuidsInput): ReadonlySet<ObjectGuid> {
  const task = input.taskRepository.getTask(input.taskInstanceId);
  if (!task) return new Set();
  const out = new Set<string>();
  walkCollectGuids(task, out, 0);
  return out as ReadonlySet<ObjectGuid>;
}
