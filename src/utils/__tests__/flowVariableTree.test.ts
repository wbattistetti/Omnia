import { describe, it, expect } from 'vitest';
import { buildFlowVariableTree, flowVariablesWithoutPath } from '../../flows/flowVariableTree';
import type { FlowVariableDefinition } from '../../flows/flowVariableTypes';

function v(id: string, label: string): FlowVariableDefinition {
  return {
    id,
    label,
    type: 'string',
    visibility: 'internal',
  };
}

describe('buildFlowVariableTree', () => {
  it('groups dot paths under a common parent', () => {
    const tree = buildFlowVariableTree([
      v('1', 'data di nascita'),
      v('2', 'data di nascita.giorno'),
      v('3', 'data di nascita.mese'),
      v('4', 'data di nascita.anno'),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].segment).toBe('data di nascita');
    expect(tree[0].variable?.id).toBe('1');
    expect(tree[0].children.map((c) => c.segment).sort()).toEqual(['anno', 'giorno', 'mese']);
    const giorno = tree[0].children.find((c) => c.segment === 'giorno');
    expect(giorno?.variable?.id).toBe('2');
    expect(giorno?.children).toHaveLength(0);
  });

  it('creates implicit parent when only children exist', () => {
    const tree = buildFlowVariableTree([v('1', 'a.b')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].segment).toBe('a');
    expect(tree[0].variable).toBeUndefined();
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].segment).toBe('b');
    expect(tree[0].children[0].variable?.id).toBe('1');
  });

  it('sorts siblings', () => {
    const tree = buildFlowVariableTree([v('1', 'z'), v('2', 'a')]);
    expect(tree.map((n) => n.segment)).toEqual(['a', 'z']);
  });
});

describe('flowVariablesWithoutPath', () => {
  it('collects empty labels', () => {
    const orphan = v('x', '');
    expect(flowVariablesWithoutPath([orphan, v('y', 'a')])).toEqual([orphan]);
  });
});
