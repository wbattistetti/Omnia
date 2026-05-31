/**
 * Raggruppa destinazioni catalogo per segmenti di path (UI ad albero nel combobox).
 */

import type { ParameterDestination } from './parameterDestinationTree';

export type DestinationPathTreeNode = {
  /** Etichetta segmento (es. `constraints`, `horizon`, `end`). */
  segment: string;
  /** Path completo fino a questo nodo (es. `constraints.horizon.end`). */
  pathPrefix: string;
  children: DestinationPathTreeNode[];
  /** Foglie selezionabili (facette SEND o voci RECEIVE). */
  destinations: ParameterDestination[];
};

function pathSegments(path: string): string[] {
  return path
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
}

function pathKeyForDestination(d: ParameterDestination): string {
  const p = (d.kind === 'receive' ? d.receivePath : d.sendPath) ?? '';
  return p.trim();
}

/**
 * Costruisce un albero da path puntati (SEND o RECEIVE) per un singolo backend tool.
 */
export function buildDestinationPathTree(
  destinations: readonly ParameterDestination[]
): DestinationPathTreeNode[] {
  const roots: DestinationPathTreeNode[] = [];
  const rootBySegment = new Map<string, DestinationPathTreeNode>();

  const ensureChild = (
    parentChildren: DestinationPathTreeNode[],
    parentPrefix: string,
    segment: string,
    cache: Map<string, DestinationPathTreeNode>
  ): DestinationPathTreeNode => {
    const key = parentPrefix ? `${parentPrefix}.${segment}` : segment;
    let node = cache.get(key);
    if (!node) {
      node = { segment, pathPrefix: key, children: [], destinations: [] };
      cache.set(key, node);
      parentChildren.push(node);
      parentChildren.sort((a, b) => a.segment.localeCompare(b.segment));
    }
    return node;
  };

  for (const dest of destinations) {
    const fullPath = pathKeyForDestination(dest);
    if (!fullPath) continue;
    const segments = pathSegments(fullPath);
    if (segments.length === 0) continue;

    let children = roots;
    let cache = rootBySegment;
    let prefix = '';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      const isLeaf = i === segments.length - 1;
      const node = ensureChild(children, prefix, seg, cache);
      prefix = node.pathPrefix;
      if (isLeaf) {
        node.destinations.push(dest);
        node.destinations.sort((a, b) =>
          (a.facetLabel ?? a.slotId).localeCompare(b.facetLabel ?? b.slotId)
        );
      } else {
        children = node.children;
        cache = new Map(node.children.map((c) => [c.pathPrefix, c]));
      }
    }
  }

  return roots;
}
