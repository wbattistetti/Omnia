import { describe, it, expect } from 'vitest';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { materializeTask } from '../MaterializationOrchestrator';

describe('materializeTask', () => {
  it('uses standalone path for kind standalone with nodes', async () => {
    const task: Task = {
      id: 't1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      kind: 'standalone',
      instanceNodes: [{ id: 'n1', templateId: 'n1', label: 'X' }],
      steps: { n1: {} },
    };

    const tree = await materializeTask(task, {});
    expect(tree).not.toBeNull();
    expect(tree!.nodes).toHaveLength(1);
  });

  it('returns null for null task', async () => {
    expect(await materializeTask(null)).toBeNull();
  });
});
