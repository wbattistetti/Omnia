import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { TaskType } from '@types/taskTypes';
import {
  findParentFlowIdContainingSubflowRow,
  parseSubflowTaskRowIdFromChildCanvasId,
  syncSubflowInterfaceAfterAuthoringCanvasChange,
} from '../syncSubflowInterfaceOnAuthoringChange';
import {
  setSubflowSyncFlows,
  setSubflowSyncUpsertFlowSlice,
  upsertFlowSlicesFromSubflowSync,
} from '../subflowSyncFlowsRef';

describe('parseSubflowTaskRowIdFromChildCanvasId', () => {
  it('returns row id after prefix', () => {
    expect(parseSubflowTaskRowIdFromChildCanvasId('subflow_abc-123')).toBe('abc-123');
  });
  it('returns null for non-subflow ids', () => {
    expect(parseSubflowTaskRowIdFromChildCanvasId('main')).toBeNull();
    expect(parseSubflowTaskRowIdFromChildCanvasId('')).toBeNull();
  });
});

describe('findParentFlowIdContainingSubflowRow', () => {
  it('finds flow slice that contains the portal row id', () => {
    const flows = {
      main: {
        nodes: [{ data: { rows: [{ id: 'portal-1', text: 'SF' }] } }],
      },
      other: { nodes: [] },
    } as any;
    expect(findParentFlowIdContainingSubflowRow(flows, 'portal-1')).toBe('main');
    expect(findParentFlowIdContainingSubflowRow(flows, 'missing')).toBeNull();
  });
});

describe('syncSubflowInterfaceAfterAuthoringCanvasChange', () => {
  const portalRowId = 'portal-row-sync-1';
  const childFlowId = `subflow_${portalRowId}`;
  const taskId = 'task-sync-1';
  const d1 = '11111111-1111-4111-8111-111111111111';

  let getVarsByTaskSpy: ReturnType<typeof vi.spyOn>;
  let getAllVarsSpy: ReturnType<typeof vi.spyOn>;
  let prevProjectData: unknown;

  beforeEach(() => {
    getVarsByTaskSpy = vi.spyOn(variableCreationService, 'getVariablesByTaskInstanceId');
    getAllVarsSpy = vi.spyOn(variableCreationService, 'getAllVariables');
    prevProjectData = (window as unknown as { __projectData?: unknown }).__projectData;
    (window as unknown as { __projectData?: unknown }).__projectData = {
      conditions: [
        {
          items: [
            {
              id: 'cond1',
              expression: { internalReferenceText: `[${d1}]`, executableCode: `[${d1}]` },
            },
          ],
        },
      ],
    };
  });

  afterEach(() => {
    getVarsByTaskSpy.mockRestore();
    getAllVarsSpy.mockRestore();
    (window as unknown as { __projectData?: unknown }).__projectData = prevProjectData;
  });

  it('returns null for Subflow task type', () => {
    setSubflowSyncFlows({ main: {} as any, [childFlowId]: {} as any });
    expect(
      syncSubflowInterfaceAfterAuthoringCanvasChange({
        projectId: 'p1',
        taskInstanceId: taskId,
        previousAuthoringCanvasId: 'main',
        nextAuthoringCanvasId: childFlowId,
        taskType: TaskType.Subflow,
      })
    ).toBeNull();
  });

  it('merges child OUTPUT for referenced task variables when moving onto subflow canvas', () => {
    taskRepository.createTask(TaskType.SayMessage, null, { label: 'Ask' }, taskId, 'p1');
    getAllVarsSpy.mockReturnValue([
      { id: d1, varName: 'colore', taskInstanceId: taskId, dataPath: 'p' },
    ] as any);
    getVarsByTaskSpy.mockReturnValue([
      { id: d1, varName: 'colore', taskInstanceId: taskId, dataPath: 'p' },
    ] as any);

    const flows = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [{ id: 'n1', data: { rows: [{ id: portalRowId, text: 'Sub' }] } }],
        edges: [{ conditionId: 'cond1' }],
      },
      [childFlowId]: {
        id: childFlowId,
        title: 'Child',
        nodes: [],
        edges: [],
        meta: { flowInterface: { input: [], output: [] } },
      },
    } as any;

    setSubflowSyncFlows(flows);

    const res = syncSubflowInterfaceAfterAuthoringCanvasChange({
      projectId: 'p1',
      taskInstanceId: taskId,
      previousAuthoringCanvasId: 'main',
      nextAuthoringCanvasId: childFlowId,
      taskType: TaskType.SayMessage,
    });

    expect(res).not.toBeNull();
    expect(res!.parentFlowId).toBe('main');
    expect(res!.childFlowId).toBe(childFlowId);
    expect(res!.referencedVarIdsForMovedTask).toContain(d1);
    const out = (res!.flowsNext[childFlowId].meta as any)?.flowInterface?.output as Array<{
      variableRefId?: string;
    }>;
    expect(out?.some((e) => e.variableRefId === d1)).toBe(true);
    expect(res!.taskMaterialization.repositoryPatchApplied).toBe(false);
  });

  it('upsertFlowSlicesFromSubflowSync forwards slices when handler is set', () => {
    const seen: string[] = [];
    const handler = (f: { id?: string }) => {
      seen.push(String(f.id));
    };
    setSubflowSyncUpsertFlowSlice(handler);
    try {
      upsertFlowSlicesFromSubflowSync(
        { a: { id: 'a', title: '', nodes: [], edges: [] } as any, b: { id: 'b', title: '', nodes: [], edges: [] } as any },
        ['a', 'b']
      );
      expect(seen).toEqual(['a', 'b']);
    } finally {
      setSubflowSyncUpsertFlowSlice(null);
    }
  });
});
