import { describe, it, expect } from 'vitest';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { buildStandaloneTaskTreeView } from '../buildStandaloneTaskTreeView';

describe('buildStandaloneTaskTreeView', () => {
  it('returns null without instanceNodes', () => {
    expect(
      buildStandaloneTaskTreeView({
        id: 'a',
        type: TaskType.UtteranceInterpretation,
        templateId: null,
      } as Task)
    ).toBeNull();
  });

  it('builds TaskTree with one node, steps, and contract from instanceSchemaContracts', () => {
    const task: Task = {
      id: 'task-id',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      labelKey: 'ask_test',
      instanceNodes: [
        {
          id: 'n1',
          templateId: 'n1',
          label: 'Field',
          icon: 'FileText',
        },
      ],
      steps: {
        n1: {
          start: { type: 'start', escalations: [] },
        },
      },
      instanceSchemaContracts: {
        n1: {
          dataContract: { templateId: 'n1', parsers: [] },
          constraints: [{ type: 'required' }],
        },
      },
    };

    const tree = buildStandaloneTaskTreeView(task);
    expect(tree).not.toBeNull();
    expect(tree!.nodes).toHaveLength(1);
    expect(tree!.nodes[0].label).toBe('Field');
    expect(tree!.steps.n1).toBeDefined();
    expect(tree!.nodes[0].dataContract).toEqual({ templateId: 'n1', parsers: [] });
    expect(tree!.nodes[0].constraints).toEqual([{ type: 'required' }]);
  });

  it('promotes node.steps into tree.steps when task.steps is empty (reload without persisted step dict)', () => {
    const task: Task = {
      id: 'task-id',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      labelKey: 'ask_test',
      instanceNodes: [
        {
          id: 'n1',
          templateId: 'n1',
          label: 'Field',
          subNodes: [],
          steps: {
            start: { type: 'start', escalations: [{ tasks: [] }] },
            noMatch: { type: 'noMatch', escalations: [{ tasks: [] }] },
          },
        },
      ],
      steps: {},
    };

    const tree = buildStandaloneTaskTreeView(task);
    expect(tree).not.toBeNull();
    expect(tree!.steps && typeof tree!.steps === 'object' && !Array.isArray(tree!.steps)).toBe(true);
    const steps = tree!.steps as Record<string, unknown>;
    expect(steps.n1).toBeDefined();
    expect((steps.n1 as Record<string, unknown>).start).toBeDefined();
    expect((steps.n1 as Record<string, unknown>).noMatch).toBeDefined();
  });
});
