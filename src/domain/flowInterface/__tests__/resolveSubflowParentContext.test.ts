import { describe, expect, it } from 'vitest';
import { findSubflowParentContextForChild } from '../resolveSubflowParentContext';
import { TaskType } from '@types/taskTypes';

describe('findSubflowParentContextForChild', () => {
  it('finds Subflow task in parent flow referencing child flowId', () => {
    const childId = 'subflow_abc';
    const subTaskId = 'task-row-1';
    const flows = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [
          {
            id: 'n1',
            data: {
              rows: [{ id: subTaskId, text: 'chiedi dati' }],
            },
          },
        ],
        edges: [],
      },
      [childId]: { id: childId, title: 'Child', nodes: [], edges: [] },
    } as any;

    const tasks = new Map<string, any>([
      [
        subTaskId,
        {
          id: subTaskId,
          type: TaskType.Subflow,
          flowId: childId,
          subflowBindings: [],
        },
      ],
    ]);

    const ctx = findSubflowParentContextForChild(flows, childId, (id) => tasks.get(id) ?? null);
    expect(ctx).not.toBeNull();
    expect(ctx!.parentFlow.id).toBe('main');
    expect(ctx!.subflowTask.flowId).toBe(childId);
  });
});
