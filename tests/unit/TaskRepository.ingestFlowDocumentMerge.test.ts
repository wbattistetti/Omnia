/**
 * Ensures flow-document ingest does not replace tasks loaded from DB with thinner rows
 * (mockTable / designer fields must survive overlay).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { taskRepository } from '../../src/services/TaskRepository';
import { TaskType } from '../../src/types/taskTypes';

const TID = '00000000-0000-4000-8000-000000000099';

describe('TaskRepository.ingestTasksFromFlowDocument merge', () => {
  afterEach(() => {
    void taskRepository.deleteTask(TID);
  });

  it('preserves mockTable when the flow slice omits it', () => {
    taskRepository.createTask(TaskType.BackendCall, null, {
      label: 'bulk',
      mockTable: { rows: [{ id: 'r1', cells: {} }], columns: [] } as any,
    } as any, TID);

    taskRepository.ingestTasksFromFlowDocument('flow-canvas-1', [
      {
        id: TID,
        type: TaskType.BackendCall,
        templateId: null,
        label: 'from-flow-doc',
      } as any,
    ]);

    const t = taskRepository.getTask(TID);
    expect(t?.label).toBe('from-flow-doc');
    expect(t?.authoringFlowCanvasId).toBe('flow-canvas-1');
    expect((t as any)?.mockTable).toEqual({ rows: [{ id: 'r1', cells: {} }], columns: [] });
  });
});
