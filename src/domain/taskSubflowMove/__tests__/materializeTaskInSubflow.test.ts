import { describe, expect, it } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { flowContainsTaskRow, materializeMovedTaskForSubflow } from '../materializeTaskInSubflow';

describe('flowContainsTaskRow', () => {
  it('detects row id in any node', () => {
    const flows = {
      main: {
        nodes: [{ id: 'n1', data: { rows: [{ id: 'task-a', text: 'x' }] } }],
      },
    } as any;
    expect(flowContainsTaskRow(flows, 'main', 'task-a')).toBe(true);
    expect(flowContainsTaskRow(flows, 'main', 'other')).toBe(false);
  });
});

describe('materializeMovedTaskForSubflow', () => {
  it('strips parent row, keeps child row, patches repository', () => {
    const taskId = 'task-mat-1';
    taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      null,
      {
        subTasks: [{ id: 'n1', label: 'root', subNodes: [{ id: 'n2', label: 'sub' }] } as any],
      },
      taskId,
      'proj-mat'
    );

    const flows = {
      main: {
        id: 'main',
        nodes: [{ id: 'pn', data: { rows: [{ id: taskId, text: 'Moved' }] } }],
      },
      sf: {
        id: 'sf',
        nodes: [{ id: 'cn', data: { rows: [{ id: taskId, text: 'Moved' }] } }],
      },
    } as any;

    const result = materializeMovedTaskForSubflow({
      projectId: 'proj-mat',
      parentFlowId: 'main',
      childFlowId: 'sf',
      taskInstanceId: taskId,
      flows,
    });

    expect(result.parentFlowContainedRowBeforeStrip).toBe(true);
    expect(flowContainsTaskRow(result.flowsNext, 'main', taskId)).toBe(false);
    expect(flowContainsTaskRow(result.flowsNext, 'sf', taskId)).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.repositoryPatchApplied).toBe(true);
    const t = taskRepository.getTask(taskId);
    expect(t?.authoringFlowCanvasId).toBe('sf');
    expect(Array.isArray(t?.subTasks)).toBe(true);
  });
});
