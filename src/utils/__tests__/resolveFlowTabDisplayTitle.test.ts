import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resolveFlowTabDisplayTitle } from '../resolveFlowTabDisplayTitle';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';

describe('resolveFlowTabDisplayTitle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(taskRepository, 'getAllTasks').mockReturnValue([]);
  });

  it('uses task name for Subflow-linked canvas over generic Subflow title', () => {
    vi.spyOn(taskRepository, 'getAllTasks').mockReturnValue([
      {
        id: 'task-sub-1',
        type: TaskType.Subflow,
        name: 'chiedi nome',
        flowId: 'flow-child-1',
      } as any,
    ]);
    const flows = {
      'flow-child-1': { title: 'Subflow' },
    };
    expect(resolveFlowTabDisplayTitle('flow-child-1', flows)).toBe('chiedi nome');
  });

  it('falls back to flow title when no Subflow task matches', () => {
    const flows = { main: { title: 'Main' } };
    expect(resolveFlowTabDisplayTitle('main', flows)).toBe('Main');
  });
});
