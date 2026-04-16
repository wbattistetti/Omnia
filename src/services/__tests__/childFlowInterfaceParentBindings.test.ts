import { describe, expect, it, vi } from 'vitest';
import { collectParentBindingSitesForChildInterfaceVariable } from '../childFlowInterfaceParentBindings';
import { taskRepository } from '../TaskRepository';
import { TaskType } from '../../types/taskTypes';

describe('collectParentBindingSitesForChildInterfaceVariable', () => {
  it('returns sites when subflowBindings reference the child variable', () => {
    const childFlowId = 'child-flow-1';
    const childVar = 'var-child-aa';

    vi.spyOn(taskRepository, 'getTask').mockImplementation((id: string) => {
      if (id === 'task-sub-1') {
        return {
          id: 'task-sub-1',
          type: TaskType.Subflow,
          flowId: childFlowId,
          subflowBindings: [{ interfaceParameterId: childVar, parentVariableId: 'parent-var-x' }],
        } as any;
      }
      return undefined;
    });

    const flows = {
      parentFlow: {
        title: 'Parent A',
        nodes: [
          {
            id: 'node-canvas-1',
            data: { rows: [{ id: 'task-sub-1', text: 'Sub' }] },
          },
        ],
      },
      [childFlowId]: { title: 'Child', nodes: [] },
    } as any;

    const sites = collectParentBindingSitesForChildInterfaceVariable(childFlowId, childVar, flows);
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({
      parentFlowId: 'parentFlow',
      parentFlowTitle: 'Parent A',
      canvasNodeId: 'node-canvas-1',
      subflowTaskId: 'task-sub-1',
    });
  });

  it('returns empty when no parentVariableId', () => {
    vi.spyOn(taskRepository, 'getTask').mockImplementation((id: string) => {
      if (id === 'task-sub-1') {
        return {
          id: 'task-sub-1',
          type: TaskType.Subflow,
          flowId: 'child-flow-1',
          subflowBindings: [{ interfaceParameterId: 'var-x', parentVariableId: '' }],
        } as any;
      }
      return undefined;
    });

    const flows = {
      p: {
        nodes: [{ id: 'n1', data: { rows: [{ id: 'task-sub-1' }] } }],
      },
    } as any;

    expect(
      collectParentBindingSitesForChildInterfaceVariable('child-flow-1', 'var-x', flows)
    ).toHaveLength(0);
  });
});
