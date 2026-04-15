import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { collectSubflowPortalRows, isCanvasRowSubflowPortal } from '../collectSubflowPortalRows';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { resolveChildFlowIdFromCanvasRow } from '@utils/resolveSubflowChildFlowId';

describe('isCanvasRowSubflowPortal', () => {
  it('uses task type when task is present', () => {
    expect(isCanvasRowSubflowPortal({ type: TaskType.Subflow }, {})).toBe(true);
    expect(isCanvasRowSubflowPortal({ type: TaskType.SayMessage }, { heuristics: { type: TaskType.Subflow } })).toBe(
      false
    );
  });

  it('uses heuristics when task is missing', () => {
    expect(isCanvasRowSubflowPortal(null, { heuristics: { type: TaskType.Subflow } })).toBe(true);
    expect(isCanvasRowSubflowPortal(null, { heuristics: { type: TaskType.SayMessage } })).toBe(false);
  });
});

describe('resolveChildFlowIdFromCanvasRow', () => {
  it('reads flowId from meta', () => {
    expect(resolveChildFlowIdFromCanvasRow({ meta: { flowId: 'subflow_x' } })).toBe('subflow_x');
    expect(resolveChildFlowIdFromCanvasRow({ meta: { childFlowId: 'subflow_y' } })).toBe('subflow_y');
  });
});

describe('collectSubflowPortalRows', () => {
  beforeEach(() => {
    vi.spyOn(taskRepository, 'getTask').mockReturnValue(null);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes a row with heuristics Subflow when task is not in repository', () => {
    const flows = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [
          {
            id: 'n1',
            data: {
              label: 'Bloc',
              rows: [
                {
                  id: 'task-row-1',
                  text: 'Chiedi dati',
                  heuristics: { type: TaskType.Subflow },
                },
              ],
            },
          },
        ],
        edges: [],
      },
    } as any;

    const rows = collectSubflowPortalRows(flows, 'main');
    expect(rows).toHaveLength(1);
    expect(rows[0].taskId).toBe('task-row-1');
    expect(rows[0].canvasNodeId).toBe('n1');
    expect(rows[0].childFlowId).toBe('');
    expect(rows[0].rowLabel).toBe('Chiedi dati');
    expect(rows[0].isChildFlowActive).toBe(false);
    expect(rows[0].dotPath).toContain('Chiedi dati');
  });
});
