/**
 * Immutable helpers for TaskTree node trees: path navigation, insert/remove/reorder, id backfill.
 */

import type { TaskTree, TaskTreeNode } from '@types/taskTypes';
import type { NodePath } from './taskTreeTypes';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/** Create a new manual editor node with stable id/templateId pair. */
export function createManualTaskTreeNode(
  label: string,
  options?: { required?: boolean }
): TaskTreeNode {
  const id = newId();
  return {
    id,
    templateId: id,
    label,
    subNodes: [],
    ...(options?.required !== undefined ? { required: options.required } : {}),
  };
}

/**
 * Deep-clone tree and assign missing node ids (and templateId when missing). Returns same reference if nothing changed.
 */
export function ensureTaskTreeNodeIds(tree: TaskTree): TaskTree {
  let changed = false;

  const walk = (node: TaskTreeNode): TaskTreeNode => {
    let n = node;
    if (!node.id || String(node.id).trim() === '') {
      const id = newId();
      n = { ...n, id, templateId: n.templateId && String(n.templateId).trim() !== '' ? n.templateId : id };
      changed = true;
    } else if (!node.templateId || String(node.templateId).trim() === '') {
      n = { ...n, templateId: node.id };
      changed = true;
    }
    const subs = Array.isArray(n.subNodes) ? n.subNodes : [];
    const nextSubs = subs.map(walk);
    if (nextSubs !== subs) {
      n = { ...n, subNodes: nextSubs };
    } else if (subs.some((s, i) => s !== nextSubs[i])) {
      n = { ...n, subNodes: nextSubs };
    }
    return n;
  };

  const nodes = (tree.nodes || []).map(walk);
  if (!changed) {
    return tree;
  }
  return { ...tree, nodes };
}

/** Resolve a node from the root `nodes` array using a path of child indices. */
export function getNodeByPath(rootNodes: TaskTreeNode[], path: NodePath): TaskTreeNode | null {
  if (!path.length) return null;
  let current: TaskTreeNode | undefined = rootNodes[path[0]];
  if (!current) return null;
  for (let d = 1; d < path.length; d++) {
    const children = Array.isArray(current.subNodes) ? current.subNodes.filter(Boolean) : [];
    current = children[path[d]];
    if (!current) return null;
  }
  return current;
}

/** Parent path: [] means root list `taskTree.nodes`. */
export function getChildrenOfParent(tree: TaskTree, parentPath: NodePath | null): TaskTreeNode[] {
  if (!parentPath || parentPath.length === 0) {
    return [...(tree.nodes || [])].filter(Boolean);
  }
  const parent = getNodeByPath(tree.nodes || [], parentPath);
  if (!parent) return [];
  return [...(Array.isArray(parent.subNodes) ? parent.subNodes : [])].filter(Boolean);
}

export function updateNodeByPath(
  tree: TaskTree,
  path: NodePath,
  updater: (node: TaskTreeNode) => TaskTreeNode
): TaskTree {
  if (!path.length) {
    throw new Error('[updateNodeByPath] Empty path');
  }
  const next = JSON.parse(JSON.stringify(tree)) as TaskTree;
  const nodes = [...(next.nodes || [])];

  const updateRecursive = (list: TaskTreeNode[], subPath: NodePath): TaskTreeNode[] => {
    if (subPath.length === 1) {
      const i = subPath[0];
      if (i < 0 || i >= list.length) return list;
      const copy = [...list];
      copy[i] = updater(copy[i]);
      return copy;
    }
    const i = subPath[0];
    if (i < 0 || i >= list.length) return list;
    const copy = [...list];
    const child = copy[i];
    const rest = subPath.slice(1);
    const subList = [...(Array.isArray(child.subNodes) ? child.subNodes : [])];
    const updatedChildren = updateRecursive(subList, rest);
    copy[i] = { ...child, subNodes: updatedChildren };
    return copy;
  };

  next.nodes = updateRecursive(nodes, path);
  return next;
}

export function replaceNodeAtPath(tree: TaskTree, path: NodePath, node: TaskTreeNode): TaskTree {
  return updateNodeByPath(tree, path, () => node);
}

export function removeNodeByPath(tree: TaskTree, path: NodePath): TaskTree {
  if (!path.length) {
    throw new Error('[removeNodeByPath] Empty path');
  }
  const next = JSON.parse(JSON.stringify(tree)) as TaskTree;

  const removeAt = (list: TaskTreeNode[], p: NodePath): TaskTreeNode[] => {
    if (p.length === 1) {
      const copy = [...list];
      const i = p[0];
      if (i < 0 || i >= copy.length) return list;
      copy.splice(i, 1);
      return copy;
    }
    const i = p[0];
    if (i < 0 || i >= list.length) return list;
    const copy = [...list];
    const child = copy[i];
    const rest = p.slice(1);
    const subList = [...(Array.isArray(child.subNodes) ? child.subNodes : [])];
    copy[i] = { ...child, subNodes: removeAt(subList, rest) };
    return copy;
  };

  next.nodes = removeAt(next.nodes || [], path);
  return next;
}

/**
 * Insert a child at `index` under `parentPath` ([] = top-level nodes).
 */
export function insertChildAt(
  tree: TaskTree,
  parentPath: NodePath | null,
  index: number,
  node: TaskTreeNode
): TaskTree {
  const next = JSON.parse(JSON.stringify(tree)) as TaskTree;

  if (!parentPath || parentPath.length === 0) {
    const nodes = [...(next.nodes || [])];
    nodes.splice(index, 0, node);
    next.nodes = nodes;
    return next;
  }

  const insertRecursive = (list: TaskTreeNode[], p: NodePath): TaskTreeNode[] => {
    if (p.length === 1) {
      const i = p[0];
      if (i < 0 || i >= list.length) return list;
      const copy = [...list];
      const parent = { ...copy[i] };
      const subs = [...(Array.isArray(parent.subNodes) ? parent.subNodes : [])];
      subs.splice(index, 0, node);
      parent.subNodes = subs;
      copy[i] = parent;
      return copy;
    }
    const i = p[0];
    if (i < 0 || i >= list.length) return list;
    const copy = [...list];
    const child = copy[i];
    const rest = p.slice(1);
    const subList = [...(Array.isArray(child.subNodes) ? child.subNodes : [])];
    const updated = insertRecursive(subList, rest);
    copy[i] = { ...child, subNodes: updated };
    return copy;
  };

  next.nodes = insertRecursive(next.nodes || [], parentPath);
  return next;
}

/** Reorder among siblings of `parentPath` (null = root). */
export function reorderSiblings(
  tree: TaskTree,
  parentPath: NodePath | null,
  from: number,
  to: number
): TaskTree {
  if (from === to) return tree;
  const next = JSON.parse(JSON.stringify(tree)) as TaskTree;

  const reorderList = (list: TaskTreeNode[]): TaskTreeNode[] => {
    const copy = [...list];
    if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) return list;
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  };

  if (!parentPath || parentPath.length === 0) {
    next.nodes = reorderList([...(next.nodes || [])]);
    return next;
  }

  const setRecursive = (list: TaskTreeNode[], p: NodePath): TaskTreeNode[] => {
    if (p.length === 1) {
      const i = p[0];
      if (i < 0 || i >= list.length) return list;
      const copy = [...list];
      const parent = { ...copy[i] };
      const subs = [...(Array.isArray(parent.subNodes) ? parent.subNodes : [])];
      parent.subNodes = reorderList(subs);
      copy[i] = parent;
      return copy;
    }
    const i = p[0];
    if (i < 0 || i >= list.length) return list;
    const copy = [...list];
    const child = copy[i];
    const rest = p.slice(1);
    const subList = [...(Array.isArray(child.subNodes) ? child.subNodes : [])];
    const updated = setRecursive(subList, rest);
    copy[i] = { ...child, subNodes: updated };
    return copy;
  };

  next.nodes = setRecursive(next.nodes || [], parentPath);
  return next;
}

/** DFS: find first path to a node with matching id. */
export function findPathById(tree: TaskTree, id: string): NodePath | null {
  const walk = (nodes: TaskTreeNode[], prefix: number[]): NodePath | null => {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const path = [...prefix, i];
      if (n.id === id) return path;
      const subs = Array.isArray(n.subNodes) ? n.subNodes.filter(Boolean) : [];
      const found = walk(subs, path);
      if (found) return found;
    }
    return null;
  };
  return walk(tree.nodes || [], []);
}
