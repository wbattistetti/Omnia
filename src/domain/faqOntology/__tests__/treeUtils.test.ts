import { describe, expect, it } from 'vitest';
import type { OntologyNode } from '@types/faqOntology';
import { OntologyDropPosition } from '@types/faqOntology';
import {
  findNode,
  findParentId,
  getSiblingContext,
  hasSiblingWithName,
  insertNode,
  insertSiblingAfter,
  insertSiblingBefore,
  isDescendant,
  isLeaf,
  moveNode,
  moveNodeIndent,
  moveNodeOutdent,
  moveNodeSiblingDown,
  moveNodeSiblingUp,
  removeNode,
} from '../treeUtils';

function n(
  id: string,
  name: string,
  children: OntologyNode[] = [],
  g: string[] = [],
  faqs: string[] = []
): OntologyNode {
  return { id, name, grammar: g, faqs, children, expanded: true };
}

describe('treeUtils', () => {
  it('isLeaf', () => {
    expect(isLeaf(n('a', 'A'))).toBe(true);
    expect(isLeaf(n('a', 'A', [n('b', 'B')]))).toBe(false);
  });

  it('findNode and findParentId', () => {
    const tree = [n('r', 'root', [n('c', 'child')])];
    expect(findNode(tree, 'c')?.name).toBe('child');
    expect(findParentId(tree, 'r')).toBe(null);
    expect(findParentId(tree, 'c')).toBe('r');
    expect(findParentId(tree, 'missing')).toBeUndefined();
  });

  it('hasSiblingWithName', () => {
    const tree = [n('a', 'One'), n('b', 'two')];
    expect(hasSiblingWithName(tree, null, 'one', undefined)).toBe(true);
    expect(hasSiblingWithName(tree, null, 'one', 'a')).toBe(false);
  });

  it('isDescendant', () => {
    const tree = [n('p', 'P', [n('c', 'C', [n('g', 'G')])])];
    expect(isDescendant(tree, 'p', 'g')).toBe(true);
    expect(isDescendant(tree, 'g', 'p')).toBe(false);
  });

  it('removeNode and insertNode', () => {
    const tree = [n('a', 'A'), n('b', 'B')];
    const { tree: t2, removed } = removeNode(tree, 'a');
    expect(removed?.id).toBe('a');
    expect(t2.length).toBe(1);
    const t3 = insertNode(t2, null, n('x', 'X'), 0);
    expect(t3.map((x) => x.id)).toEqual(['x', 'b']);
  });

  it('moveNode before', () => {
    const tree = [n('a', 'A'), n('b', 'B')];
    const next = moveNode(tree, 'b', 'a', OntologyDropPosition.Before);
    expect(next.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('getSiblingContext', () => {
    const tree = [n('a', 'A'), n('b', 'B', [n('c', 'C')])];
    expect(getSiblingContext(tree, 'a')).toEqual({
      parentId: null,
      index: 0,
      prevId: null,
      nextId: 'b',
    });
    expect(getSiblingContext(tree, 'c')?.prevId).toBe(null);
    expect(getSiblingContext(tree, 'c')?.parentId).toBe('b');
  });

  it('moveNodeIndent: figlio ultimo del fratello sopra', () => {
    const tree = [n('a', 'A'), n('b', 'B')];
    const next = moveNodeIndent(tree, 'b');
    expect(next.length).toBe(1);
    expect(next[0].id).toBe('a');
    expect(next[0].children.map((c) => c.id)).toEqual(['b']);
  });

  it('moveNodeOutdent: dopo il genitore', () => {
    const tree = [n('a', 'A', [n('b', 'B')])];
    const next = moveNodeOutdent(tree, 'b');
    expect(next.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('moveNodeSiblingUp / Down', () => {
    const two = [n('a', 'A'), n('b', 'B')];
    expect(moveNodeSiblingUp(two, 'b').map((x) => x.id)).toEqual(['b', 'a']);
    expect(moveNodeSiblingDown(two, 'a').map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('insertSiblingBefore / After', () => {
    const tree = [n('a', 'A'), n('b', 'B')];
    const x = n('x', 'X');
    const before = insertSiblingBefore(tree, 'b', x);
    expect(before.map((n0) => n0.id)).toEqual(['a', 'x', 'b']);
    const y = n('y', 'Y');
    const after = insertSiblingAfter(before, 'x', y);
    expect(after.map((n0) => n0.id)).toEqual(['a', 'x', 'y', 'b']);
  });
});
