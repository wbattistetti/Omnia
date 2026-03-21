/**
 * Build a trie from flat mapping entries (dot paths) for tree rendering.
 * A node has `entry` iff a row exists exactly at that path (parameter vs group-only).
 */

import type { MappingEntry } from './mappingTypes';

export interface MappingTreeNode {
  segment: string;
  pathKey: string;
  children: MappingTreeNode[];
  /** Present when this path is an explicit mapping row. */
  entry?: MappingEntry;
}

function splitPath(path: string): string[] {
  return path
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

type Mutable = {
  segment: string;
  pathKey: string;
  entry?: MappingEntry;
  children: Map<string, Mutable>;
};

/**
 * Merges all entries into one tree; sorts children by segment.
 */
export function buildMappingTree(entries: MappingEntry[]): MappingTreeNode[] {
  const root = new Map<string, Mutable>();

  for (const entry of entries) {
    const parts = splitPath(entry.internalPath);
    if (parts.length === 0) continue;

    let map = root;
    let pathSoFar = '';

    for (let i = 0; i < parts.length; i += 1) {
      const segment = parts[i];
      pathSoFar = i === 0 ? segment : `${pathSoFar}.${segment}`;

      let node = map.get(segment);
      if (!node) {
        node = { segment, pathKey: pathSoFar, children: new Map() };
        map.set(segment, node);
      }

      if (i === parts.length - 1) {
        node.entry = entry;
      }

      map = node.children;
    }
  }

  function minIndexInSubtree(pathKey: string): number {
    let m = Number.POSITIVE_INFINITY;
    for (let i = 0; i < entries.length; i += 1) {
      const p = entries[i].internalPath;
      if (p === pathKey || p.startsWith(`${pathKey}.`)) m = Math.min(m, i);
    }
    return m === Number.POSITIVE_INFINITY ? Number.MAX_SAFE_INTEGER : m;
  }

  function toArray(m: Map<string, Mutable>): MappingTreeNode[] {
    return Array.from(m.values())
      .sort((a, b) => {
        const ia = minIndexInSubtree(a.pathKey);
        const ib = minIndexInSubtree(b.pathKey);
        if (ia !== ib) return ia - ib;
        return a.segment.localeCompare(b.segment, undefined, { sensitivity: 'base' });
      })
      .map((n) => ({
        segment: n.segment,
        pathKey: n.pathKey,
        entry: n.entry,
        children: toArray(n.children),
      }));
  }

  return toArray(root);
}

/** Parent path for "a.b.c" -> "a.b"; single segment -> "". */
export function parentPathKey(pathKey: string): string {
  const idx = pathKey.lastIndexOf('.');
  return idx === -1 ? '' : pathKey.slice(0, idx);
}

/** Replace last segment of pathKey with newSegment. */
export function renameLeafSegment(pathKey: string, newSegment: string): string {
  const parent = parentPathKey(pathKey);
  const trimmed = newSegment.trim();
  if (!trimmed) return pathKey;
  return parent ? `${parent}.${trimmed}` : trimmed;
}
