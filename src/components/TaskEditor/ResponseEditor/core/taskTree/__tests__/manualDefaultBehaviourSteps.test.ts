import { describe, it, expect } from 'vitest';
import {
  createDefaultManualStepDictionary,
  createManualTaskTreeNodeWithDefaultBehaviour,
  mergeTaskTreeStepsForTemplate,
  withDefaultManualBehaviourSteps,
} from '../manualDefaultBehaviourSteps';
import { createManualTaskTreeNode } from '../taskTreeUtils';
import type { TaskTree } from '@types/taskTypes';

describe('manualDefaultBehaviourSteps', () => {
  it('createDefaultManualStepDictionary has start and noMatch with escalations', () => {
    const d = createDefaultManualStepDictionary();
    expect(Object.keys(d).sort()).toEqual(['noMatch', 'start']);
    expect(d.start.type).toBe('start');
    expect(d.start.escalations).toEqual([{ tasks: [] }]);
    expect(d.noMatch.type).toBe('noMatch');
  });

  it('withDefaultManualBehaviourSteps preserves existing steps', () => {
    const n = createManualTaskTreeNode('x');
    const withSteps = {
      ...n,
      steps: { start: { type: 'start', escalations: [{ tasks: [] }] } },
    };
    expect(withDefaultManualBehaviourSteps(withSteps as any)).toBe(withSteps);
  });

  it('createManualTaskTreeNodeWithDefaultBehaviour seeds node and treePatch', () => {
    const { node, treePatch } = createManualTaskTreeNodeWithDefaultBehaviour('field', { required: true });
    expect(Object.keys(node.steps || {}).sort()).toEqual(['noMatch', 'start']);
    const base: TaskTree = { labelKey: 'm', nodes: [node], steps: {} };
    const patched = treePatch(base);
    const tid = node.templateId!;
    expect(patched.steps?.[tid]?.start).toBeDefined();
    expect(patched.steps?.[tid]?.noMatch).toBeDefined();
  });

  it('mergeTaskTreeStepsForTemplate does not overwrite existing keys', () => {
    const tid = 'tpl1';
    const tree: TaskTree = {
      labelKey: 'x',
      nodes: [],
      steps: {
        [tid]: {
          start: { type: 'start', escalations: [{ tasks: [{ id: 't1' }] }] },
        },
      },
    };
    const next = mergeTaskTreeStepsForTemplate(tree, tid, createDefaultManualStepDictionary());
    expect(next.steps?.[tid]?.start).toEqual(tree.steps![tid].start);
    expect(next.steps?.[tid]?.noMatch).toBeDefined();
  });
});
