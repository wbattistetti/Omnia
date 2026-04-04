import { describe, it, expect } from 'vitest';
import {
  buildSemanticSlotsFromSingleRootTree,
  buildNewGrammarWithSlotsFromMainList,
} from '../grammarFlowInitialSlots';
import type { TaskTreeNode } from '@types/taskTypes';

function node(partial: Partial<TaskTreeNode> & Pick<TaskTreeNode, 'id' | 'label'>): TaskTreeNode {
  return {
    subNodes: [],
    ...partial,
  };
}

describe('grammarFlowInitialSlots', () => {
  it('returns null when mainList is not exactly one root', () => {
    expect(buildNewGrammarWithSlotsFromMainList(null)).toBeNull();
    expect(buildNewGrammarWithSlotsFromMainList([])).toBeNull();
    expect(
      buildNewGrammarWithSlotsFromMainList([
        node({ id: 'a', label: 'A' }),
        node({ id: 'b', label: 'B' }),
      ])
    ).toBeNull();
  });

  it('builds one slot per node in DFS order for a single root with children', () => {
    const root = node({
      id: 'root-id',
      taskId: 'root-task',
      label: 'Nominativo',
      subNodes: [
        node({ id: 'n1', label: 'Nome' }),
        node({ id: 'n2', label: 'Cognome' }),
      ],
    });

    const slots = buildSemanticSlotsFromSingleRootTree(root);
    expect(slots).toHaveLength(3);
    expect(slots[0]).toMatchObject({
      id: 'root-task',
      name: 'Nominativo',
      type: 'string',
    });
    expect(slots[1]).toMatchObject({ id: 'n1', name: 'Nome' });
    expect(slots[2]).toMatchObject({ id: 'n2', name: 'Cognome' });
  });

  it('uses node.id when taskId is absent', () => {
    const root = node({ id: 'only-id', label: 'X' });
    const slots = buildSemanticSlotsFromSingleRootTree(root);
    expect(slots[0].id).toBe('only-id');
  });

  it('deduplicates slot names when labels collide after normalization', () => {
    const root = node({
      id: 'r',
      label: 'Data',
      subNodes: [node({ id: 'a', label: 'Data' }), node({ id: 'b', label: 'Data' })],
    });
    const slots = buildSemanticSlotsFromSingleRootTree(root);
    expect(slots.map((s) => s.name)).toEqual(['Data', 'Data_1', 'Data_2']);
  });

  it('buildNewGrammarWithSlotsFromMainList returns grammar with slots', () => {
    const g = buildNewGrammarWithSlotsFromMainList([
      node({ id: 'r', label: 'Root' }),
    ]);
    expect(g).not.toBeNull();
    expect(g!.slots).toHaveLength(1);
    expect(g!.nodes).toEqual([]);
  });
});
