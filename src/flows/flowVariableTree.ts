/**
 * Builds a tree from flow variable labels using dot notation (e.g. "a.b.c").
 * Prefix-only nodes (no variable at that path) act as group headers; leaf or
 * intermediate nodes may hold a FlowVariableDefinition when the label matches exactly.
 */

import type { FlowVariableDefinition } from './flowVariableTypes';

export interface FlowVariableTreeNode {
  /** Last segment of the path (display). */
  segment: string;
  /** Full path key, e.g. "data di nascita.giorno". */
  pathKey: string;
  variable?: FlowVariableDefinition;
  children: FlowVariableTreeNode[];
}

function splitLabel(label: string): string[] {
  return label
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

type MutableNode = {
  segment: string;
  pathKey: string;
  variable?: FlowVariableDefinition;
  children: Map<string, MutableNode>;
};

/**
 * Inserts variables into a path tree; sorts segments lexicographically at each level.
 */
export function buildFlowVariableTree(variables: FlowVariableDefinition[]): FlowVariableTreeNode[] {
  const root = new Map<string, MutableNode>();

  for (const v of variables) {
    const parts = splitLabel(v.label ?? '');
    if (parts.length === 0) {
      continue;
    }

    let map = root;
    let pathSoFar = '';

    for (let i = 0; i < parts.length; i += 1) {
      const segment = parts[i];
      pathSoFar = i === 0 ? segment : `${pathSoFar}.${segment}`;

      let node = map.get(segment);
      if (!node) {
        node = { segment, pathKey: pathSoFar, children: new Map() };
        map.set(segment, node);
      } else if (node.pathKey !== pathSoFar) {
        // Should not happen if segment keys are unique per level
        node.pathKey = pathSoFar;
      }

      if (i === parts.length - 1) {
        node.variable = v;
      }

      map = node.children;
    }
  }

  function toSortedArray(m: Map<string, MutableNode>): FlowVariableTreeNode[] {
    return Array.from(m.values())
      .sort((a, b) => a.segment.localeCompare(b.segment, undefined, { sensitivity: 'base' }))
      .map((n) => ({
        segment: n.segment,
        pathKey: n.pathKey,
        variable: n.variable,
        children: toSortedArray(n.children),
      }));
  }

  return toSortedArray(root);
}

/**
 * Depth-first path keys as rendered in the tree (matches on-screen order).
 */
export function flattenFlowVariablePathKeysDfs(nodes: FlowVariableTreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: FlowVariableTreeNode[]) => {
    for (const n of list) {
      out.push(n.pathKey);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/**
 * Variables with empty or whitespace-only labels (shown outside the tree).
 */
export function flowVariablesWithoutPath(variables: FlowVariableDefinition[]): FlowVariableDefinition[] {
  return variables.filter((v) => splitLabel(v.label ?? '').length === 0);
}
