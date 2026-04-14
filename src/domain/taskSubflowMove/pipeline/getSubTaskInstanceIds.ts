/**
 * Canonical step: nested TaskTreeNode instance ids under the moved task root.
 */

import type { TaskTreeNode } from '@types/taskTypes';
import type { TaskRepositoryAdapter } from '../adapters/taskRepositoryAdapter';

export type GetSubTaskInstanceIdsInput = {
  taskInstanceId: string;
  taskRepository: TaskRepositoryAdapter;
};

function collectSubNodeIds(node: TaskTreeNode | undefined, out: Set<string>): void {
  if (!node) return;
  const subs = node.subNodes ?? node.subTasks;
  if (!subs?.length) return;
  for (const ch of subs) {
    const id = String(ch.id || '').trim();
    if (id) out.add(id);
    collectSubNodeIds(ch, out);
  }
}

/**
 * Collects sub-node ids from persisted `Task.subTasks` (authoring tree).
 */
export function GetSubTaskInstanceIds(input: GetSubTaskInstanceIdsInput): ReadonlySet<string> {
  const t = input.taskRepository.getTask(input.taskInstanceId);
  const roots = t?.subTasks;
  if (!roots?.length) return new Set();
  const out = new Set<string>();
  for (const n of roots) {
    const id = String(n.id || '').trim();
    if (id) out.add(id);
    collectSubNodeIds(n, out);
  }
  return out;
}
