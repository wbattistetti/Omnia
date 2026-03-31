/**
 * Tests for standalone task branches in buildTaskTree and extractTaskOverrides
 * (no ensureTemplateExists / no DialogueTaskService template required).
 */

import { describe, expect, it } from 'vitest';
import type { Task, TaskTree } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { buildTaskTree, extractTaskOverrides } from '../taskUtils';

const minimalInstanceNode = {
  id: 'node-a',
  label: 'Root',
  templateId: 'UtteranceInterpretation',
  subNodes: [],
} as any;

describe('buildTaskTree standalone branch', () => {
  it('returns view from subTasks without requiring templateId', async () => {
    const instance: Task = {
      id: 'task-1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      kind: 'standalone',
      subTasks: [minimalInstanceNode],
      steps: {},
    } as Task;

    const tree = await buildTaskTree(instance, 'project-1');
    expect(tree).not.toBeNull();
    expect(tree!.nodes).toHaveLength(1);
    expect(tree!.nodes[0].id).toBe('node-a');
  });

  it('returns minimal tree when standalone has no persisted nodes', async () => {
    const instance: Task = {
      id: 'task-2',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      kind: 'standalone',
      subTasks: [],
      steps: {},
    } as Task;

    const tree = await buildTaskTree(instance, 'project-1');
    expect(tree).not.toBeNull();
    expect(tree!.nodes).toEqual([]);
  });
});

describe('extractTaskOverrides standalone branch', () => {
  it('returns kind, subTasks and steps without projectId', async () => {
    const instance: Task = {
      id: 'task-1',
      type: TaskType.UtteranceInterpretation,
      templateId: null,
      kind: 'standalone',
      subTasks: [minimalInstanceNode],
      steps: { 'node-a': { start: [] } },
    } as Task;

    const workingCopy: TaskTree = {
      labelKey: 'my-label',
      nodes: [minimalInstanceNode],
      steps: { 'node-a': { start: [{ text: 'x' }] } },
    };

    const overrides = await extractTaskOverrides(instance, workingCopy);
    expect(overrides.kind).toBe('standalone');
    expect(overrides.subTasks).toHaveLength(1);
    expect(overrides.subTasks![0].id).toBe('node-a');
    expect(overrides.steps).toEqual(workingCopy.steps);
    expect(overrides.labelKey).toBe('my-label');
  });
});
