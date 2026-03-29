import { describe, expect, it } from 'vitest';
import type { TaskTree, TaskTreeNode } from '@types/taskTypes';
import { ensureTaskTreeStepSlicesForAllNodes } from '../ensureTaskTreeStepSlicesForAllNodes';
import { createDefaultManualStepDictionary } from '../manualDefaultBehaviourSteps';

function node(id: string, label: string, sub?: TaskTreeNode[]): TaskTreeNode {
  return {
    id,
    templateId: id,
    label,
    subNodes: sub ?? [],
  };
}

describe('ensureTaskTreeStepSlicesForAllNodes', () => {
  it('returns same tree when there are no nodes', () => {
    const tree: TaskTree = { labelKey: 'x', nodes: [], steps: {} };
    const out = ensureTaskTreeStepSlicesForAllNodes(tree);
    expect(out).toBe(tree);
  });

  it('fills empty TaskTree.steps slot for each node with default start/noMatch', () => {
    const n = node('aaa-111', 'field');
    const tree: TaskTree = {
      labelKey: 't',
      nodes: [n],
      steps: {},
    };
    const out = ensureTaskTreeStepSlicesForAllNodes(tree);
    expect(out.steps?.['aaa-111']).toEqual(createDefaultManualStepDictionary());
  });

  it('does not overwrite existing step keys; only adds missing among defaults', () => {
    const n = node('bbb-222', 'field');
    const customStart = { type: 'start', escalations: [{ tasks: [{ id: 'x' }] }] };
    const tree: TaskTree = {
      labelKey: 't',
      nodes: [n],
      steps: {
        'bbb-222': {
          start: customStart,
        },
      },
    };
    const out = ensureTaskTreeStepSlicesForAllNodes(tree);
    expect(out.steps?.['bbb-222']?.start).toEqual(customStart);
    expect(out.steps?.['bbb-222']?.noMatch).toEqual({
      type: 'noMatch',
      escalations: [{ tasks: [] }],
    });
  });

  it('walks nested subNodes', () => {
    const child = node('child-1', 'sub');
    const root = node('root-1', 'root', [child]);
    const tree: TaskTree = {
      labelKey: 't',
      nodes: [root],
      steps: {},
    };
    const out = ensureTaskTreeStepSlicesForAllNodes(tree);
    expect(out.steps?.['root-1']).toEqual(createDefaultManualStepDictionary());
    expect(out.steps?.['child-1']).toEqual(createDefaultManualStepDictionary());
  });
});
