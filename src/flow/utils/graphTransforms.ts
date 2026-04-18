/**
 * Pure graph helpers for React Flow: outgoing-edge descendant discovery and node translation.
 */

import type { Edge, Node } from 'reactflow';

/**
 * Returns strict descendants of `rootId` following outgoing edges (source → target).
 * `rootId` itself is never included. BFS order; cycles are handled via `visited`.
 */
export function getDescendantNodeIds(rootId: string, edges: Edge[]): Set<string> {
  const visited = new Set<string>();
  const out = new Set<string>();
  const q: string[] = [];

  for (const e of edges) {
    if (e.source === rootId && e.target !== rootId && !visited.has(e.target)) {
      visited.add(e.target);
      out.add(e.target);
      q.push(e.target);
    }
  }

  while (q.length > 0) {
    const cur = q.shift()!;
    for (const e of edges) {
      if (e.source === cur && e.target !== rootId && !visited.has(e.target)) {
        visited.add(e.target);
        out.add(e.target);
        q.push(e.target);
      }
    }
  }

  return out;
}

/**
 * Returns a new node array with `dx`/`dy` added to each node whose `id` is in `ids`.
 * If nothing moves, returns the original `nodes` reference.
 */
export function translateNodes<T extends Node>(
  nodes: T[],
  ids: Set<string>,
  dx: number,
  dy: number
): T[] {
  if (ids.size === 0 || (dx === 0 && dy === 0)) {
    return nodes;
  }

  return nodes.map((n) =>
    ids.has(n.id)
      ? ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } as T)
      : n
  );
}
