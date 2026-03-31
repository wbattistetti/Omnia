import { describe, it, expect } from 'vitest';
import type { TaskTreeNode } from '@types/taskTypes';
import { mergeInstanceNodeStepsIntoTreeSteps } from '../instanceNodeStepsFlatten';

describe('mergeInstanceNodeStepsIntoTreeSteps', () => {
  it('fills empty task-level slots from node.steps', () => {
    const nodes: TaskTreeNode[] = [
      {
        id: 'n1',
        templateId: 'n1',
        label: 'A',
        steps: { start: { type: 'start', escalations: [] } },
      },
    ];
    const out = mergeInstanceNodeStepsIntoTreeSteps(nodes, {});
    expect((out.n1 as Record<string, unknown>).start).toBeDefined();
  });

  it('does not overwrite non-empty task-level slot', () => {
    const nodes: TaskTreeNode[] = [
      {
        id: 'n1',
        templateId: 'n1',
        label: 'A',
        steps: { start: { type: 'start', escalations: [{ tasks: [] }] } },
      },
    ];
    const existing = { n1: { start: { type: 'start', escalations: [] } } };
    const out = mergeInstanceNodeStepsIntoTreeSteps(nodes, existing);
    expect((out.n1 as Record<string, unknown>).start).toEqual(existing.n1.start);
  });

  it('walks subNodes', () => {
    const nodes: TaskTreeNode[] = [
      {
        id: 'root',
        templateId: 'root',
        label: 'R',
        subNodes: [
          {
            id: 'child',
            templateId: 'child',
            label: 'C',
            steps: { noMatch: { type: 'noMatch', escalations: [] } },
          },
        ],
      },
    ];
    const out = mergeInstanceNodeStepsIntoTreeSteps(nodes, {});
    expect((out.child as Record<string, unknown>).noMatch).toBeDefined();
  });
});
