/**
 * Pure operations on OntologyNode trees (immutable updates).
 */

import type { OntologyNode } from '@types/faqOntology';
import { OntologyDropPosition } from '@types/faqOntology';

export function isLeaf(node: OntologyNode): boolean {
  return node.children.length === 0;
}

export function findNode(nodes: OntologyNode[], id: string): OntologyNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Parent id of `targetId`, or `null` if the node is at root, or `undefined` if not found.
 */
export function findParentId(
  nodes: OntologyNode[],
  targetId: string,
  parentId: string | null = null
): string | null | undefined {
  for (const n of nodes) {
    if (n.id === targetId) return parentId;
    const r = findParentId(n.children, targetId, n.id);
    if (r !== undefined) return r;
  }
  return undefined;
}

/** True if `nodeId` is a strict descendant of `ancestorId` (ancestor must exist). */
export function isDescendant(nodes: OntologyNode[], ancestorId: string, nodeId: string): boolean {
  if (ancestorId === nodeId) return false;
  const anc = findNode(nodes, ancestorId);
  if (!anc) return false;
  const walk = (n: OntologyNode): boolean => {
    if (n.id === nodeId) return true;
    return n.children.some((c) => walk(c));
  };
  return walk(anc);
}

export function insertNode(
  nodes: OntologyNode[],
  parentId: string | null,
  newNode: OntologyNode,
  index?: number
): OntologyNode[] {
  if (parentId === null) {
    const arr = [...nodes];
    const i = index === undefined ? arr.length : Math.max(0, Math.min(index, arr.length));
    arr.splice(i, 0, newNode);
    return arr;
  }
  return nodes.map((node) => {
    if (node.id === parentId) {
      const ch = [...node.children];
      const i = index === undefined ? ch.length : Math.max(0, Math.min(index, ch.length));
      ch.splice(i, 0, newNode);
      return { ...node, children: ch };
    }
    if (node.children.length) {
      return { ...node, children: insertNode(node.children, parentId, newNode, index) };
    }
    return node;
  });
}

export function removeNode(
  nodes: OntologyNode[],
  id: string
): { tree: OntologyNode[]; removed: OntologyNode | null } {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx >= 0) {
    const removed = nodes[idx];
    return { tree: [...nodes.slice(0, idx), ...nodes.slice(idx + 1)], removed };
  }
  for (let i = 0; i < nodes.length; i++) {
    const { tree: newChildren, removed } = removeNode(nodes[i].children, id);
    if (removed) {
      return {
        tree: nodes.map((n, j) => (j === i ? { ...n, children: newChildren } : n)),
        removed,
      };
    }
  }
  return { tree: nodes, removed: null };
}

export function updateNode(
  nodes: OntologyNode[],
  id: string,
  updater: (n: OntologyNode) => OntologyNode
): OntologyNode[] {
  return nodes.map((n) => {
    if (n.id === id) return updater(n);
    if (n.children.length) {
      return { ...n, children: updateNode(n.children, id, updater) };
    }
    return n;
  });
}

export function getNodePath(nodes: OntologyNode[], targetId: string): string[] | null {
  const path: string[] = [];
  const dfs = (list: OntologyNode[]): boolean => {
    for (const n of list) {
      path.push(n.name);
      if (n.id === targetId) return true;
      if (dfs(n.children)) return true;
      path.pop();
    }
    return false;
  };
  const ok = dfs(nodes);
  return ok ? path : null;
}

export function hasSiblingWithName(
  nodes: OntologyNode[],
  parentId: string | null,
  name: string,
  excludeId?: string
): boolean {
  const norm = name.trim().toLowerCase();
  if (!norm) return false;
  const siblings =
    parentId === null ? nodes : (findNode(nodes, parentId)?.children ?? []);
  return siblings.some(
    (s) => s.id !== excludeId && s.name.trim().toLowerCase() === norm
  );
}

/** Visual-only sort (does not mutate persisted order). */
export function sortNodesAlphabetical(nodes: OntologyNode[]): OntologyNode[] {
  return [...nodes]
    .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }))
    .map((n) => ({ ...n, children: sortNodesAlphabetical(n.children) }));
}

/**
 * Contesto di lista di fratelli per un nodo: indice e id del precedente/successivo (se esistono).
 */
export function getSiblingContext(
  nodes: OntologyNode[],
  id: string
): {
  parentId: string | null;
  index: number;
  prevId: string | null;
  nextId: string | null;
} | null {
  const rootIdx = nodes.findIndex((n) => n.id === id);
  if (rootIdx >= 0) {
    return {
      parentId: null,
      index: rootIdx,
      prevId: rootIdx > 0 ? nodes[rootIdx - 1].id : null,
      nextId: rootIdx < nodes.length - 1 ? nodes[rootIdx + 1].id : null,
    };
  }
  const pid = findParentId(nodes, id);
  if (pid === undefined || pid === null) return null;
  const parent = findNode(nodes, pid);
  if (!parent) return null;
  const index = parent.children.findIndex((c) => c.id === id);
  if (index < 0) return null;
  return {
    parentId: pid,
    index,
    prevId: index > 0 ? parent.children[index - 1].id : null,
    nextId:
      index < parent.children.length - 1 ? parent.children[index + 1].id : null,
  };
}

/** Inserisce un nuovo fratello immediatamente prima del nodo target (stesso parent). */
export function insertSiblingBefore(
  nodes: OntologyNode[],
  targetId: string,
  newNode: OntologyNode
): OntologyNode[] {
  const ctx = getSiblingContext(nodes, targetId);
  if (!ctx) return nodes;
  if (hasSiblingWithName(nodes, ctx.parentId, newNode.name, newNode.id)) {
    return nodes;
  }
  return insertNode(nodes, ctx.parentId, newNode, ctx.index);
}

/** Inserisce un nuovo fratello immediatamente dopo il nodo target (stesso parent). */
export function insertSiblingAfter(
  nodes: OntologyNode[],
  targetId: string,
  newNode: OntologyNode
): OntologyNode[] {
  const ctx = getSiblingContext(nodes, targetId);
  if (!ctx) return nodes;
  if (hasSiblingWithName(nodes, ctx.parentId, newNode.name, newNode.id)) {
    return nodes;
  }
  return insertNode(nodes, ctx.parentId, newNode, ctx.index + 1);
}

/** Ctrl+→: ultimo figlio del fratello precedente (indent). */
export function moveNodeIndent(nodes: OntologyNode[], id: string): OntologyNode[] {
  const ctx = getSiblingContext(nodes, id);
  if (!ctx?.prevId) return nodes;
  const { tree: without, removed } = removeNode(nodes, id);
  if (!removed) return nodes;
  if (hasSiblingWithName(without, ctx.prevId, removed.name, removed.id)) {
    return nodes;
  }
  let next = insertNode(without, ctx.prevId, removed, undefined);
  next = updateNode(next, ctx.prevId, (p) => ({ ...p, expanded: true }));
  return next;
}

/**
 * Ctrl+←: stesso livello del genitore, subito dopo il genitore (outdent).
 * La radice non può uscire oltre il livello root.
 */
export function moveNodeOutdent(nodes: OntologyNode[], id: string): OntologyNode[] {
  const pid = findParentId(nodes, id);
  if (pid === undefined || pid === null) return nodes;
  const { tree: without, removed } = removeNode(nodes, id);
  if (!removed) return nodes;
  const ctxP = getSiblingContext(without, pid);
  if (!ctxP) return nodes;
  if (hasSiblingWithName(without, ctxP.parentId, removed.name, removed.id)) {
    return nodes;
  }
  return insertNode(without, ctxP.parentId, removed, ctxP.index + 1);
}

/** Ctrl+↑: scambia con il fratello sopra (stesso parent). */
export function moveNodeSiblingUp(nodes: OntologyNode[], id: string): OntologyNode[] {
  const ctx = getSiblingContext(nodes, id);
  if (!ctx?.prevId) return nodes;
  return moveNode(nodes, id, ctx.prevId, OntologyDropPosition.Before);
}

/** Ctrl+↓: scambia con il fratello sotto (stesso parent). */
export function moveNodeSiblingDown(nodes: OntologyNode[], id: string): OntologyNode[] {
  const ctx = getSiblingContext(nodes, id);
  if (!ctx?.nextId) return nodes;
  return moveNode(nodes, id, ctx.nextId, OntologyDropPosition.After);
}

function siblingIndexAndParent(
  nodes: OntologyNode[],
  targetId: string
): { parentId: string | null; index: number } | null {
  const rootIdx = nodes.findIndex((n) => n.id === targetId);
  if (rootIdx >= 0) return { parentId: null, index: rootIdx };
  const pid = findParentId(nodes, targetId);
  if (pid === undefined || pid === null) return null;
  const parent = findNode(nodes, pid);
  if (!parent) return null;
  const index = parent.children.findIndex((c) => c.id === targetId);
  return index >= 0 ? { parentId: pid, index } : null;
}

export function moveNode(
  nodes: OntologyNode[],
  draggingId: string,
  targetId: string,
  position: OntologyDropPosition
): OntologyNode[] {
  if (draggingId === targetId) return nodes;
  if (
    position === OntologyDropPosition.Inside &&
    isDescendant(nodes, draggingId, targetId)
  ) {
    return nodes;
  }

  const { tree: without, removed } = removeNode(nodes, draggingId);
  if (!removed) return nodes;

  if (position === OntologyDropPosition.Inside) {
    const target = findNode(without, targetId);
    if (!target) return nodes;
    return insertNode(without, targetId, { ...removed, expanded: removed.expanded }, undefined);
  }

  const rel = siblingIndexAndParent(without, targetId);
  if (!rel) return nodes;

  if (position === OntologyDropPosition.Before) {
    const insertIndex = rel.parentId === null ? rel.index : rel.index;
    return insertNode(without, rel.parentId, removed, insertIndex);
  }

  if (position === OntologyDropPosition.After) {
    const insertIndex = rel.index + 1;
    return insertNode(without, rel.parentId, removed, insertIndex);
  }

  return nodes;
}
