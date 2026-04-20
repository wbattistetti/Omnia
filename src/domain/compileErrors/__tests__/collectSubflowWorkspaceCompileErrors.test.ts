import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Node } from 'reactflow';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import { TaskType } from '@types/taskTypes';

const getFlowById = vi.fn();
vi.mock('@flows/FlowWorkspaceSnapshot', () => ({
  FlowWorkspaceSnapshot: { getFlowById: (...args: unknown[]) => getFlowById(...args) },
}));

const loadFlow = vi.fn();
vi.mock('@flows/FlowPersistence', () => ({
  loadFlow: (...args: unknown[]) => loadFlow(...args),
}));

const getTask = vi.fn();
vi.mock('@services/TaskRepository', () => ({
  taskRepository: { getTask: (...args: unknown[]) => getTask(...args) },
}));

import { collectSubflowWorkspaceCompileErrors } from '../collectSubflowWorkspaceCompileErrors';

describe('collectSubflowWorkspaceCompileErrors', () => {
  beforeEach(() => {
    getFlowById.mockReset();
    loadFlow.mockReset();
    getTask.mockReset();
  });

  it('emits SubflowChildNotRunnable when snapshot and persisted child are empty', async () => {
    getTask.mockImplementation((id: string) =>
      id === 'row-sub'
        ? ({
            id: 'row-sub',
            type: TaskType.Subflow,
            flowId: 'subflow_child',
          } as Record<string, unknown>)
        : null
    );
    getFlowById.mockReturnValue(null);
    loadFlow.mockResolvedValue({ nodes: [], edges: [] });

    const nodes: Node<FlowNode>[] = [
      {
        id: 'n1',
        data: {
          rows: [{ id: 'row-sub', text: 'Chiedi dati personali' }],
        },
      } as Node<FlowNode>,
    ];

    const errs = await collectSubflowWorkspaceCompileErrors({
      enrichedNodes: nodes,
      projectId: 'pid',
    });
    expect(errs).toHaveLength(1);
    expect(errs[0].code).toBe('SubflowChildNotRunnable');
    expect(errs[0].rowLabel).toBe('Chiedi dati personali');
    expect(loadFlow).toHaveBeenCalledWith('pid', 'subflow_child');
  });

  it('does not emit when child snapshot has at least one row', async () => {
    getTask.mockImplementation((id: string) =>
      id === 'row-sub'
        ? ({ id: 'row-sub', type: TaskType.Subflow, flowId: 'subflow_child' } as Record<string, unknown>)
        : null
    );
    getFlowById.mockReturnValue({
      nodes: [
        {
          id: 'cn',
          data: { rows: [{ id: 'r1', text: 'Start' }] },
        },
      ],
      edges: [],
    });

    const nodes: Node<FlowNode>[] = [
      {
        id: 'n1',
        data: { rows: [{ id: 'row-sub', text: 'Sub' }] },
      } as Node<FlowNode>,
    ];

    const errs = await collectSubflowWorkspaceCompileErrors({
      enrichedNodes: nodes,
      projectId: 'pid',
    });
    expect(errs).toHaveLength(0);
    expect(loadFlow).not.toHaveBeenCalled();
  });
});
