/**
 * Scoped Task lookup for UtteranceInterpretation: resolve repository rows in the context
 * of a flow root task and optional template-definition tasks.
 */

import type { Task, TaskTreeNode } from '@types/taskTypes';

function nodeRowId(node: TaskTreeNode): string {
  const raw = node.taskId ?? node.id;
  return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
}

/**
 * Collects every task id referenced in the persisted sub-task tree (recursive).
 */
export function collectTaskIdsInSubTasksTree(nodes: TaskTreeNode[] | undefined | null): string[] {
  const out: string[] = [];
  const walk = (n: TaskTreeNode) => {
    const tid = nodeRowId(n);
    if (tid) out.push(tid);
    const subs = n.subNodes;
    if (Array.isArray(subs) && subs.length > 0) {
      subs.forEach(walk);
    }
  };
  if (Array.isArray(nodes)) {
    nodes.forEach(walk);
  }
  return out;
}

/**
 * Returns true if `taskId` appears anywhere in the subtree under `root.subTasks`.
 */
export function rootSubTasksTreeContainsTaskId(root: Task | null | undefined, taskId: string): boolean {
  if (!root || !taskId) return false;
  const want = taskId.trim();
  const nodes = root.subTasks;
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  return collectTaskIdsInSubTasksTree(nodes).some((id) => id === want);
}

export type GetTaskFn = (id: string) => Task | null;

/**
 * Resolves the Task row for editor display:
 * - `(rowNodeId, null)` → root task of the Response Editor tab.
 * - `(rowNodeId, rowNodeId)` → same root.
 * - `(rowNodeId, subTaskId)` → subtask row, validated under root's persisted `subTasks` tree.
 *
 * For contract templates: use `resolveTemplateDefinitionTask(node.templateId, getTask)`.
 */
export function resolveTaskInEditorScope(
  rootTaskId: string,
  nodeTaskId: string | null | undefined,
  getTask: GetTaskFn
): Task | null {
  const root = rootTaskId ? getTask(rootTaskId.trim()) : null;
  if (!root) return null;

  const nodeId = nodeTaskId != null && String(nodeTaskId).trim() !== ''
    ? String(nodeTaskId).trim()
    : rootTaskId.trim();

  if (nodeId === rootTaskId.trim()) {
    return root;
  }

  const target = getTask(nodeId);
  if (!target) return null;

  if (!rootSubTasksTreeContainsTaskId(root, nodeId)) {
    throw new Error(
      `[resolveTaskInEditorScope] Task "${nodeId}" is not part of subTasks tree under root "${rootTaskId}".`
    );
  }

  return target;
}

/**
 * Loads the template-definition task used for contracts when `node.templateId` is set (same repository id space).
 */
export function resolveTemplateDefinitionTask(templateId: string | null | undefined, getTask: GetTaskFn): Task | null {
  if (templateId == null || String(templateId).trim() === '') return null;
  return getTask(String(templateId).trim());
}
