import { describe, it, expect } from 'vitest';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { resolveNodeDataContract } from '../taskNodeContractResolver';

function task(over: Partial<Task>): Task {
  return {
    id: 'task-row-id',
    type: TaskType.UtteranceInterpretation,
    templateId: null,
    ...over,
  } as Task;
}

describe('resolveNodeDataContract', () => {
  it('standalone materialized: returns node.dataContract and ignores node.templateId', () => {
    const t = task({ templateId: null });
    const node = {
      id: 'node-1',
      templateId: 'local-slot-id-not-in-cache',
      dataContract: {
        engines: [{ type: 'regex', patterns: ['\\d+'] }],
        testPhrases: ['a', 'b'],
      },
    };
    const c = resolveNodeDataContract(t, node);
    expect(c?.engines?.length).toBe(1);
    expect((c?.engines?.[0] as { patterns?: string[] })?.patterns?.[0]).toBe('\\d+');
  });

  it('standalone materialized: returns null when no node contract on tree node', () => {
    const t = task({ templateId: null });
    const node = {
      id: 'node-1',
      templateId: '27ba6d4a-1111-2222-3333-444444444444',
    };
    expect(resolveNodeDataContract(t, node)).toBeNull();
  });

  it('task without catalogue ref and without kind yet: returns node.dataContract (same as instance path)', () => {
    const t = task({ templateId: null });
    const node = {
      id: 'node-1',
      templateId: 'graph-slot-id',
      dataContract: { engines: [{ type: 'regex', patterns: ['\\d+'] }] },
    };
    const c = resolveNodeDataContract(t, node);
    expect((c?.engines?.[0] as { patterns?: string[] })?.patterns?.[0]).toBe('\\d+');
  });

  it('template-backed row: prefers node.dataContract over task.templateId cache', () => {
    const t = task({
      templateId: '11111111-2222-3333-4444-555555555555',
    });
    const node = {
      id: 'node-1',
      templateId: 'slot-local',
      dataContract: {
        engines: [{ type: 'regex', patterns: ['override'] }],
      },
    };
    const c = resolveNodeDataContract(t, node);
    expect((c?.engines?.[0] as { patterns?: string[] })?.patterns?.[0]).toBe('override');
  });
});
