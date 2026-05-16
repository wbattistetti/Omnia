/**
 * Adapter: trie `MappingTreeNode` (wireKey) → dati per react-arborist.
 */

import type { MappingTreeNode } from './mappingTreeUtils';

export type BackendArboristNodeData = {
  id: string;
  treeNode: MappingTreeNode;
  children?: BackendArboristNodeData[];
};

export function mappingForestToArboristData(roots: readonly MappingTreeNode[]): BackendArboristNodeData[] {
  return roots.map(mapMappingTreeNode);
}

function mapMappingTreeNode(node: MappingTreeNode): BackendArboristNodeData {
  const childData = node.children.map(mapMappingTreeNode);
  if (childData.length === 0) {
    return { id: node.pathKey, treeNode: node };
  }
  return { id: node.pathKey, treeNode: node, children: childData };
}

/** Apre tutti i prefissi del path nell’albero Arborist (visibilità dopo insert/drop). */
export function expandArboristAncestors(
  open: (id: string) => void,
  wireKey: string
): void {
  const parts = wireKey
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let acc = '';
  for (let i = 0; i < parts.length - 1; i += 1) {
    acc = i === 0 ? parts[0]! : `${acc}.${parts[i]!}`;
    open(acc);
  }
}
