import { describe, it, expect } from 'vitest';
import type { TaskTree } from '@types/taskTypes';
import type { TaskPipelineStatus } from '@TaskBuilderAIWizard/types/WizardTaskTreeNode';
import { buildWizardStructureView, mergeWizardPipelineIntoNodes } from '../wizardStructureFromTaskTree';

describe('wizardStructureFromTaskTree', () => {
  it('mergeWizardPipelineIntoNodes overlays pipeline state by node id', () => {
    const roots = [
      {
        id: 'a',
        templateId: 'a',
        label: 'Root',
        subNodes: [{ id: 'b', templateId: 'b', label: 'Child' }],
      },
    ];
    const byId: Record<string, TaskPipelineStatus> = {
      b: { constraints: 'completed', parser: 'pending', messages: 'pending' },
    };
    const merged = mergeWizardPipelineIntoNodes(roots as any, byId);
    expect(merged[0].pipelineStatus?.constraints).toBe('pending');
    expect(merged[0].subNodes?.[0].pipelineStatus?.constraints).toBe('completed');
  });

  it('buildWizardStructureView returns empty when taskTree has no nodes', () => {
    const tree: TaskTree = { labelKey: 'k', nodes: [] };
    expect(buildWizardStructureView(tree, {})).toEqual([]);
    expect(buildWizardStructureView(null, {})).toEqual([]);
  });
});
