import { describe, expect, it } from 'vitest';
import {
  findTaskTreeNodeById,
  flattenUtteranceTaskTreeVariableRows,
  initialUtteranceLabelForNode,
} from '../utteranceTaskVariableSync';
import type { TaskTreeNode } from '@types/taskTypes';

describe('flattenUtteranceTaskTreeVariableRows', () => {
  it('single root: one var row with id and data path', () => {
    const roots: TaskTreeNode[] = [
      { id: 'n1', templateId: 'n1', label: 'Dimmi se siete', subNodes: [] },
    ];
    const rows = flattenUtteranceTaskTreeVariableRows(roots);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('n1');
    expect(rows[0].dataPath).toBe('data[0]');
  });

  it('nested: child rows use subData paths', () => {
    const roots: TaskTreeNode[] = [
      {
        id: 'm1',
        templateId: 'm1',
        label: 'Data',
        subNodes: [{ id: 's1', templateId: 's1', label: 'Giorno', subNodes: [] }],
      },
    ];
    const rows = flattenUtteranceTaskTreeVariableRows(roots);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.dataPath]));
    expect(byId.m1).toBe('data[0]');
    expect(byId.s1).toBe('data[0].subData[0]');
  });
});

describe('findTaskTreeNodeById', () => {
  it('returns nested node by id', () => {
    const roots: TaskTreeNode[] = [
      {
        id: 'm1',
        templateId: 'm1',
        label: 'Root',
        subNodes: [{ id: 's1', templateId: 's1', label: 'Child', subNodes: [] }],
      },
    ];
    expect(findTaskTreeNodeById(roots, 's1')?.label).toBe('Child');
    expect(findTaskTreeNodeById(roots, 'missing')).toBeNull();
  });
});

describe('initialUtteranceLabelForNode', () => {
  it('derives label only from that node task label (semantic normalization)', () => {
    const node: TaskTreeNode = {
      id: 'x',
      templateId: 'x',
      label: 'Chiedi il giorno',
      subNodes: [],
    };
    const label = initialUtteranceLabelForNode(node);
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toContain('.');
  });

  it('uses default when label empty', () => {
    const node: TaskTreeNode = { id: 'x', templateId: 'x', label: '', subNodes: [] };
    expect(initialUtteranceLabelForNode(node)).toBe('dato');
  });
});
