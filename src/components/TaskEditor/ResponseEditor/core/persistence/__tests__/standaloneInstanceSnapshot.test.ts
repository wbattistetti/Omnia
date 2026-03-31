import { describe, expect, it } from 'vitest';
import type { Task, TaskTree } from '@types/taskTypes';
import { TaskType, TemplateSource } from '@types/taskTypes';
import {
  cloneMainNodesForInstancePersistence,
  shouldPersistStandaloneInstanceSnapshot,
} from '../standaloneInstanceSnapshot';

function treeWithOneMainNode(): TaskTree {
  return {
    labelKey: 't',
    nodes: [
      {
        id: 'n1',
        label: 'Main',
        type: 'main',
        templateId: 'UtteranceInterpretation',
        subNodes: [],
      } as any,
    ],
    steps: {},
  };
}

describe('shouldPersistStandaloneInstanceSnapshot', () => {
  it('returns false when there are no main nodes', () => {
    const task: Task = { id: '1', type: TaskType.UtteranceInterpretation, templateId: null } as Task;
    const tree: TaskTree = { labelKey: 't', nodes: [], steps: {} };
    expect(shouldPersistStandaloneInstanceSnapshot(task, tree)).toBe(false);
  });

  it('returns true for UtteranceInterpretation with catalogue UUID templateId (persist main nodes)', () => {
    const task: Task = {
      id: '1',
      type: TaskType.UtteranceInterpretation,
      templateId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    } as Task;
    expect(shouldPersistStandaloneInstanceSnapshot(task, treeWithOneMainNode())).toBe(true);
  });

  it('returns false for factory template source', () => {
    const task: Task = {
      id: '1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      source: TemplateSource.Factory,
    } as Task;
    expect(shouldPersistStandaloneInstanceSnapshot(task, treeWithOneMainNode())).toBe(false);
  });

  it('returns true for UtteranceInterpretation even when inferTaskKind would be instance (semantic template id)', () => {
    const task: Task = {
      id: '1',
      type: TaskType.UtteranceInterpretation,
      templateId: 'UtteranceInterpretation',
    } as Task;
    expect(shouldPersistStandaloneInstanceSnapshot(task, treeWithOneMainNode())).toBe(true);
  });

  it('returns true for UtteranceInterpretation with null templateId and no subTasksIds (migration row)', () => {
    const task: Task = {
      id: '1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
    } as Task;
    expect(shouldPersistStandaloneInstanceSnapshot(task, treeWithOneMainNode())).toBe(true);
  });

  it('returns false when project template has subTasksIds', () => {
    const task: Task = {
      id: '1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      subTasksIds: ['child-1'],
    } as Task;
    expect(shouldPersistStandaloneInstanceSnapshot(task, treeWithOneMainNode())).toBe(false);
  });
});

describe('cloneMainNodesForInstancePersistence', () => {
  it('returns a deep copy (mutations do not affect the original tree)', () => {
    const tree = treeWithOneMainNode();
    const cloned = cloneMainNodesForInstancePersistence(tree);
    cloned[0].label = 'changed';
    expect((tree.nodes[0] as any).label).toBe('Main');
  });
});
