import { describe, expect, it } from 'vitest';
import type { VariableInstance } from '@types/variableTypes';
import { mergeVariableRowsByIdPreferStore } from '../inferTaskVariableInstancesForSubflowMerge';

describe('mergeVariableRowsByIdPreferStore', () => {
  it('prefers store row when ids collide', () => {
    const inferred: VariableInstance[] = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', taskInstanceId: 't', dataPath: '' },
    ];
    const store: VariableInstance[] = [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        taskInstanceId: 't',
        dataPath: 'p',
      },
    ];
    const m = mergeVariableRowsByIdPreferStore(store, inferred);
    expect(m).toHaveLength(1);
    expect(m[0].dataPath).toBe('p');
  });

  it('union by id and sorts deterministically', () => {
    const a: VariableInstance[] = [
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', taskInstanceId: 't', dataPath: '' },
    ];
    const b: VariableInstance[] = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', taskInstanceId: 't', dataPath: '' },
    ];
    const m = mergeVariableRowsByIdPreferStore(a, b);
    expect(m.map((x) => x.id)).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ]);
  });
});
