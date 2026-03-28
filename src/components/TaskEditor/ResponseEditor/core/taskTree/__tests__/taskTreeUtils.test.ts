import { describe, it, expect } from 'vitest';
import type { TaskTree, TaskTreeNode } from '@types/taskTypes';
import {
  createManualTaskTreeNode,
  ensureTaskTreeNodeIds,
  findPathById,
  getNodeByPath,
  insertChildAt,
  removeNodeByPath,
  reorderSiblings,
  replaceNodeAtPath,
  updateNodeByPath,
} from '../taskTreeUtils';

function sampleTree(): TaskTree {
  const a: TaskTreeNode = { id: 'a', templateId: 'a', label: 'A', subNodes: [] };
  const b: TaskTreeNode = { id: 'b', templateId: 'b', label: 'B', subNodes: [] };
  return {
    labelKey: 'k',
    nodes: [a, b],
    steps: {},
  };
}

describe('taskTreeUtils', () => {
  it('getNodeByPath resolves nested nodes', () => {
    const child = createManualTaskTreeNode('c');
    const tree = sampleTree();
    tree.nodes[0] = { ...tree.nodes[0], subNodes: [child] };
    const p = findPathById(tree, child.id);
    expect(p).toEqual([0, 0]);
    expect(getNodeByPath(tree.nodes, p!).id).toBe(child.id);
  });

  it('reorderSiblings moves root nodes', () => {
    const tree = sampleTree();
    const next = reorderSiblings(tree, null, 0, 1);
    expect(next.nodes.map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('removeNodeByPath removes nested node', () => {
    const child = createManualTaskTreeNode('c');
    let tree = sampleTree();
    tree.nodes[0] = { ...tree.nodes[0], subNodes: [child] };
    tree = removeNodeByPath(tree, [0, 0]);
    expect(tree.nodes[0].subNodes?.length ?? 0).toBe(0);
  });

  it('insertChildAt adds under parent path', () => {
    const tree = sampleTree();
    const n = createManualTaskTreeNode('x');
    const next = insertChildAt(tree, [0], 0, n);
    expect(next.nodes[0].subNodes?.[0].label).toBe('x');
  });

  it('updateNodeByPath updates label', () => {
    const tree = sampleTree();
    const next = updateNodeByPath(tree, [1], (node) => ({ ...node, label: 'BB' }));
    expect(next.nodes[1].label).toBe('BB');
  });

  it('replaceNodeAtPath replaces node', () => {
    const tree = sampleTree();
    const rep = createManualTaskTreeNode('rep');
    const next = replaceNodeAtPath(tree, [0], rep);
    expect(next.nodes[0].id).toBe(rep.id);
  });

  it('ensureTaskTreeNodeIds fills missing ids', () => {
    const tree: TaskTree = {
      labelKey: 'k',
      nodes: [{ label: 'x', subNodes: [] } as TaskTreeNode],
      steps: {},
    };
    const next = ensureTaskTreeNodeIds(tree);
    expect(next.nodes[0].id).toBeTruthy();
    expect(next.nodes[0].templateId).toBe(next.nodes[0].id);
  });

  it('ensureTaskTreeNodeIds returns same ref when nothing missing', () => {
    const tree = sampleTree();
    const next = ensureTaskTreeNodeIds(tree);
    expect(next).toBe(tree);
  });
});
