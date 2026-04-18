/**
 * Tests for graphTransforms: BFS descendants and immutable translation.
 */

import { describe, it, expect } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { getDescendantNodeIds, translateNodes } from '../graphTransforms';

function e(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

describe('getDescendantNodeIds', () => {
  it('excludes root and returns direct children only when no deeper edges', () => {
    const edges = [e('1', 'a', 'b'), e('2', 'a', 'c')];
    const s = getDescendantNodeIds('a', edges);
    expect(s.has('a')).toBe(false);
    expect([...s].sort()).toEqual(['b', 'c']);
  });

  it('collects transitive descendants via BFS order layers', () => {
    const edges = [e('1', 'a', 'b'), e('2', 'b', 'c'), e('3', 'c', 'd')];
    const s = getDescendantNodeIds('a', edges);
    expect([...s].sort()).toEqual(['b', 'c', 'd']);
  });

  it('handles cycles without infinite loop', () => {
    const edges = [e('1', 'a', 'b'), e('2', 'b', 'c'), e('3', 'c', 'a')];
    const s = getDescendantNodeIds('a', edges);
    expect([...s].sort()).toEqual(['b', 'c']);
  });

  it('shared child from two parents appears once', () => {
    const edges = [e('1', 'a', 'x'), e('2', 'b', 'x'), e('3', 'root', 'a'), e('4', 'root', 'b')];
    const s = getDescendantNodeIds('root', edges);
    expect([...s].sort()).toEqual(['a', 'b', 'x']);
  });

  it('returns empty set when no outgoing edges', () => {
    expect(getDescendantNodeIds('alone', []).size).toBe(0);
  });
});

describe('translateNodes', () => {
  const mk = (id: string, x: number, y: number): Node =>
    ({ id, position: { x, y }, data: {} }) as Node;

  it('translates only ids in the set', () => {
    const nodes = [mk('a', 0, 0), mk('b', 10, 20), mk('c', 5, 5)];
    const ids = new Set(['b']);
    const out = translateNodes(nodes, ids, 3, -4);
    expect(out[0]).toBe(nodes[0]);
    expect(out[2]).toBe(nodes[2]);
    expect(out[1].position).toEqual({ x: 13, y: 16 });
  });

  it('returns same reference when dx dy zero', () => {
    const nodes = [mk('a', 1, 2)];
    expect(translateNodes(nodes, new Set(['a']), 0, 0)).toBe(nodes);
  });

  it('returns same reference when ids empty', () => {
    const nodes = [mk('a', 1, 2)];
    expect(translateNodes(nodes, new Set(), 5, 5)).toBe(nodes);
  });

  it('applies horizontal and vertical deltas together (e.g. Δwidth/2 + Δheight)', () => {
    const nodes = [mk('a', 0, 0), mk('b', 100, 50)];
    const ids = new Set(['b']);
    const out = translateNodes(nodes, ids, 12, -7);
    expect(out[1].position).toEqual({ x: 112, y: 43 });
  });

  it('handles large id set without quadratic includes', () => {
    const nodes: Node[] = Array.from({ length: 500 }, (_, i) => mk(`n${i}`, i, i));
    const ids = new Set(nodes.slice(0, 250).map((n) => n.id));
    const out = translateNodes(nodes, ids, 0, 1);
    expect(out[0].position.y).toBe(1);
    expect(out[250].position.y).toBe(250);
  });
});
