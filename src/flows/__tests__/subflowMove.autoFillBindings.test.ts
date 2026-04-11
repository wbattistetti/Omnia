/**
 * S2: auto-fill `subflowBindings` after task → subflow move (interfaceParameterId = variableRefId, never MappingEntry.id).
 */

import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { TaskType } from '@types/taskTypes';
import type { VariableInstance } from '@types/variableTypes';
import {
  autoFillSubflowBindingsForMovedTask,
  extractInterfaceOutputsByVariableRefId,
} from '@domain/taskSubflowMove/autoFillSubflowBindings';
import { applyTaskMoveToSubflow } from '@domain/taskSubflowMove/applyTaskMoveToSubflow';
import * as collectReferenced from '@domain/taskSubflowMove/collectReferencedVarIds';
import { makeTranslationKey } from '@utils/translationKeys';
import { setProjectTranslationsRegistry } from '@utils/projectTranslationsRegistry';

/** Mirrors VB `SubflowTaskExecutor.ApplyPopBindings` for tests. */
function applyPopLikeRuntime(
  childStore: Record<string, unknown>,
  parentStore: Record<string, unknown>,
  bindings: Array<{ interfaceParameterId: string; parentVariableId: string }>
): void {
  for (const b of bindings) {
    const cId = String(b?.interfaceParameterId || '').trim();
    const pId = String(b?.parentVariableId || '').trim();
    if (!cId || !pId) continue;
    parentStore[pId] = childStore[cId];
  }
}

const G_CHILD_TELEFONO = '1cee6a03-1907-4468-944e-f3599fc8a563';
/** Deliberately different from variableRefId — must never appear in subflowBindings.interfaceParameterId */
const MAPPING_ENTRY_ROW_ID = 'e4eb96d7-3814-4b30-a0d0-f04ce78fcd6e';

describe('autoFillSubflowBindingsForMovedTask (S2)', () => {
  beforeEach(() => {
    vi.spyOn(variableCreationService, 'hydrateVariablesFromFlow').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets interfaceParameterId from variableRefId, never MappingEntry.id', () => {
    const projectId = `proj_${Math.random().toString(36).slice(2, 10)}`;
    const subflowTaskId = `sf_${Math.random().toString(36).slice(2, 10)}`;

    taskRepository.createTask(
      TaskType.Subflow,
      null,
      { flowId: 'child_f', subflowBindingsSchemaVersion: 1, subflowBindings: [] },
      subflowTaskId,
      projectId
    );

    const childFlow = {
      id: 'child_f',
      title: 'Child',
      nodes: [],
      edges: [],
      meta: {
        flowInterface: {
          input: [],
          output: [
            {
              id: MAPPING_ENTRY_ROW_ID,
              wireKey: 'telefono',
              apiField: '',
              variableRefId: G_CHILD_TELEFONO,
            },
          ],
        },
      },
    } as const;

    vi.spyOn(variableCreationService, 'getAllVariables').mockReturnValue([
      {
        id: G_CHILD_TELEFONO,
        taskInstanceId: 'moved_task',
        dataPath: 'd',
        scope: 'flow',
        scopeFlowId: 'parent_f',
      } as VariableInstance,
    ]);

    const ok = autoFillSubflowBindingsForMovedTask({
      projectId,
      parentFlowId: 'parent_f',
      parentFlow: { id: 'parent_f', title: 'P', nodes: [], edges: [] } as any,
      childFlow: childFlow as any,
      subflowTaskId,
      taskVariableIds: [G_CHILD_TELEFONO],
    });

    expect(ok).toBe(true);
    const t = taskRepository.getTask(subflowTaskId);
    expect(t?.subflowBindings?.length).toBeGreaterThan(0);
    const row = t?.subflowBindings?.[0];
    expect(row?.interfaceParameterId).toBe(G_CHILD_TELEFONO);
    expect(row?.parentVariableId).toBe(G_CHILD_TELEFONO);
    expect(row?.interfaceParameterId).not.toBe(MAPPING_ENTRY_ROW_ID);
  });

  it('extractInterfaceOutputsByVariableRefId keys by variableRefId only', () => {
    const childFlow = {
      meta: {
        flowInterface: {
          output: [
            {
              id: MAPPING_ENTRY_ROW_ID,
              variableRefId: G_CHILD_TELEFONO,
              wireKey: 'telefono',
            },
          ],
        },
      },
    } as any;
    const m = extractInterfaceOutputsByVariableRefId(childFlow);
    expect(m.has(G_CHILD_TELEFONO)).toBe(true);
    expect(m.has(MAPPING_ENTRY_ROW_ID)).toBe(false);
  });

  it('PopFlow transfers child value to parent using binding keys', () => {
    const G_PARENT = '11111111-1111-4111-8111-111111111111';
    const G_CHILD = '22222222-2222-4222-8222-222222222222';

    const parentStore: Record<string, unknown> = {};
    const childStore: Record<string, unknown> = { [G_CHILD]: 'telefono' };

    applyPopLikeRuntime(childStore, parentStore, [
      { interfaceParameterId: G_CHILD, parentVariableId: G_PARENT },
    ]);

    expect(parentStore[G_PARENT]).toBe('telefono');
    expect(parentStore[G_CHILD]).toBeUndefined();
  });

  it('applyTaskMoveToSubflow fills subflowBindings when interface outputs exist', () => {
    const projectId = `proj_int_${Math.random().toString(36).slice(2, 10)}`;
    const movedTaskId = `moved_${Math.random().toString(36).slice(2, 10)}`;
    const subflowTaskId = `portal_${Math.random().toString(36).slice(2, 10)}`;
    const parentFlowId = 'parent_flow';
    const childFlowId = 'child_flow';

    const vid = '33333333-3333-4333-8333-333333333333';

    taskRepository.createTask(TaskType.SayMessage, null, {}, movedTaskId, projectId);
    taskRepository.createTask(
      TaskType.Subflow,
      null,
      { flowId: childFlowId, subflowBindingsSchemaVersion: 1, subflowBindings: [] },
      subflowTaskId,
      projectId
    );

    vi.spyOn(collectReferenced, 'collectReferencedVarIdsForParentFlowWorkspace').mockReturnValue(
      new Set([vid])
    );

    const taskVar: VariableInstance = {
      id: vid,
      taskInstanceId: movedTaskId,
      dataPath: 'd',
      scope: 'flow',
      scopeFlowId: childFlowId,
    };

    vi.spyOn(variableCreationService, 'getVariablesByTaskInstanceId').mockReturnValue([taskVar]);
    const svc = variableCreationService as unknown as { projectKey: (p: string) => string; store: Map<string, VariableInstance[]> };
    const storeKey = svc.projectKey(projectId);
    svc.store.set(storeKey, [taskVar]);

    const flows = {
      [parentFlowId]: {
        id: parentFlowId,
        title: 'Main',
        nodes: [],
        edges: [],
      },
      [childFlowId]: {
        id: childFlowId,
        title: 'Sub',
        nodes: [],
        edges: [],
        meta: {
          flowInterface: {
            input: [],
            output: [],
          },
        },
      },
    } as any;

    setProjectTranslationsRegistry({
      [makeTranslationKey('var', vid)]: 'telefono',
    });

    const result = applyTaskMoveToSubflow({
      projectId,
      parentFlowId,
      childFlowId,
      taskInstanceId: movedTaskId,
      subflowDisplayTitle: 'chiedi dati',
      parentSubflowTaskRowId: subflowTaskId,
      flows,
      skipMaterialization: true,
      skipStructuralPhase: true,
    });

    expect(result.guidMappingParentSubflow.some((g) => g.id === vid)).toBe(true);

    const portal = taskRepository.getTask(subflowTaskId);
    expect(portal?.subflowBindings?.length).toBeGreaterThan(0);
    const b = portal?.subflowBindings ?? [];
    for (const row of b) {
      expect(String(row.interfaceParameterId)).toBe(vid);
      expect(String(row.parentVariableId)).toBe(vid);
    }

    const outs = result.flowsNext[childFlowId]?.meta?.flowInterface?.output ?? [];
    expect(Array.isArray(outs)).toBe(true);
    const refIds = outs.map((o: any) => String(o?.variableRefId || '').trim()).filter(Boolean);
    expect(refIds).toContain(vid);

    const parent: Record<string, unknown> = {};
    const child: Record<string, unknown> = { [vid]: 'telefono' };
    applyPopLikeRuntime(child, parent, b);
    expect(parent[vid]).toBe('telefono');

    expect(result.parentAutoRenames.length).toBe(1);
    expect(result.parentAutoRenames[0]?.nextName).toBe('dati.telefono');

    const ptr = (result.flowsNext[parentFlowId]?.meta as { translations?: Record<string, string> } | undefined)
      ?.translations;
    expect(ptr?.[makeTranslationKey('var', vid)]).toBe('dati.telefono');
  });

  it('applyTaskMoveToSubflow: zero refs in parent → no interface rows, no bindings, no rename; unreferenced rows removed', () => {
    const projectId = `proj_emptyscan_${Math.random().toString(36).slice(2, 10)}`;
    const movedTaskId = `moved_${Math.random().toString(36).slice(2, 10)}`;
    const subflowTaskId = `portal_${Math.random().toString(36).slice(2, 10)}`;
    const parentFlowId = 'parent_flow';
    const childFlowId = 'child_flow';
    const vid = '44444444-4444-4444-8444-444444444444';

    taskRepository.createTask(TaskType.SayMessage, null, {}, movedTaskId, projectId);
    taskRepository.createTask(
      TaskType.Subflow,
      null,
      { flowId: childFlowId, subflowBindingsSchemaVersion: 1, subflowBindings: [] },
      subflowTaskId,
      projectId
    );

    vi.spyOn(collectReferenced, 'collectReferencedVarIdsForParentFlowWorkspace').mockReturnValue(new Set());

    const taskVar: VariableInstance = {
      id: vid,
      taskInstanceId: movedTaskId,
      dataPath: 'd',
      scope: 'flow',
      scopeFlowId: childFlowId,
    };

    vi.spyOn(variableCreationService, 'getVariablesByTaskInstanceId').mockReturnValue([taskVar]);
    const svc = variableCreationService as unknown as { projectKey: (p: string) => string; store: Map<string, VariableInstance[]> };
    const storeKey = svc.projectKey(projectId);
    svc.store.set(storeKey, [taskVar]);

    const flows = {
      [parentFlowId]: {
        id: parentFlowId,
        title: 'Main',
        nodes: [],
        edges: [],
      },
      [childFlowId]: {
        id: childFlowId,
        title: 'Sub',
        nodes: [],
        edges: [],
        meta: {
          flowInterface: {
            input: [],
            output: [],
          },
        },
      },
    } as any;

    const result = applyTaskMoveToSubflow({
      projectId,
      parentFlowId,
      childFlowId,
      taskInstanceId: movedTaskId,
      subflowDisplayTitle: 'chiedi dati',
      parentSubflowTaskRowId: subflowTaskId,
      flows,
      skipMaterialization: true,
      skipStructuralPhase: true,
    });

    expect(result.referencedVarIdsForMovedTask.length).toBe(0);
    expect(result.guidMappingParentSubflow.length).toBe(0);
    const portal = taskRepository.getTask(subflowTaskId);
    expect(portal?.subflowBindings?.length ?? 0).toBe(0);
    expect(result.parentAutoRenames.length).toBe(0);

    const outs = result.flowsNext[childFlowId]?.meta?.flowInterface?.output ?? [];
    expect(Array.isArray(outs)).toBe(true);
    expect(outs.length).toBe(0);

    expect(result.removedUnreferencedVariableRows).toBeGreaterThanOrEqual(1);
    expect(result.unreferencedVarIdsForMovedTask).toContain(vid);
  });
});
