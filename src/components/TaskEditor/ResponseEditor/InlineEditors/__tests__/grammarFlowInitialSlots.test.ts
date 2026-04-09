import { describe, it, expect } from 'vitest';
import {
  buildSemanticSlotsAndBindingsFromSingleRootTree,
  buildNewGrammarWithSlotsFromMainList,
} from '../grammarFlowInitialSlots';
import type { TaskTreeNode } from '@types/taskTypes';
import { SAFE_GUID_PATTERN } from '@utils/idGenerator';

function node(partial: Partial<TaskTreeNode> & Pick<TaskTreeNode, 'id' | 'label'>): TaskTreeNode {
  return {
    subNodes: [],
    ...partial,
  };
}

describe('grammarFlowInitialSlots (G2)', () => {
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

  it('builds one slot per node with distinct grammar ids and slotBindings to flow variable ids', () => {
    const root = node({
      id: 'root-id',
      taskId: 'root-task',
      label: 'Nominativo',
      subNodes: [
        node({ id: 'n1', label: 'Nome' }),
        node({ id: 'n2', label: 'Cognome' }),
      ],
    });

    const { slots, slotBindings } = buildSemanticSlotsAndBindingsFromSingleRootTree(root);
    expect(slots).toHaveLength(3);
    expect(slotBindings).toHaveLength(3);
    for (const s of slots) {
      expect(s.id).toMatch(SAFE_GUID_PATTERN);
    }
    expect(slotBindings[0]).toEqual({ grammarSlotId: slots[0].id, flowVariableId: 'root-task' });
    expect(slotBindings[1]).toEqual({ grammarSlotId: slots[1].id, flowVariableId: 'n1' });
    expect(slotBindings[2]).toEqual({ grammarSlotId: slots[2].id, flowVariableId: 'n2' });
    expect(slots[0].name).toBe('Nominativo');
    expect(slots[1].name).toBe('Nome');
  });

  it('uses node.id as flowVariableId when taskId is absent', () => {
    const root = node({ id: 'only-id', label: 'X' });
    const { slots, slotBindings } = buildSemanticSlotsAndBindingsFromSingleRootTree(root);
    expect(slots).toHaveLength(1);
    expect(slotBindings[0].flowVariableId).toBe('only-id');
    expect(slots[0].id).not.toBe('only-id');
  });

  it('deduplicates slot names when labels collide after normalization', () => {
    const root = node({
      id: 'r',
      label: 'Data',
      subNodes: [node({ id: 'a', label: 'Data' }), node({ id: 'b', label: 'Data' })],
    });
    const { slots } = buildSemanticSlotsAndBindingsFromSingleRootTree(root);
    expect(slots.map((s) => s.name)).toEqual(['Data', 'Data_1', 'Data_2']);
  });

  it('buildNewGrammarWithSlotsFromMainList returns grammar with slots and slotBindings', () => {
    const g = buildNewGrammarWithSlotsFromMainList([node({ id: 'r', label: 'Root' })]);
    expect(g).not.toBeNull();
    expect(g!.slots).toHaveLength(1);
    expect(g!.slotBindings).toHaveLength(1);
    expect(g!.nodes).toEqual([]);
  });
});
