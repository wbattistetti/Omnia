/**
 * Golden parity: canonical vs legacy on the same logical input.
 * Re-seeds translation registry + variable store between runs so global `var:` labels do not leak.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { TaskType } from '@types/taskTypes';
import type { VariableInstance } from '@types/variableTypes';
import { makeTranslationKey } from '@utils/translationKeys';
import { setProjectTranslationsRegistry } from '@utils/projectTranslationsRegistry';
import * as collectReferenced from '../collectReferencedVarIds';
import { applyTaskMoveToSubflow } from '../applyTaskMoveToSubflow';
import { applyTaskMoveToSubflowLegacy } from '../applyTaskMoveToSubflow.legacy';
import type { ApplyTaskMoveToSubflowParams } from '../applyTaskMoveToSubflowParams';

const rowsByProjectTask = new Map<string, VariableInstance[]>();

function kt(pid: string, tid: string): string {
  return `${pid}\0${tid}`;
}

function seedRegistryAndStore(params: {
  projectId: string;
  movedTaskId: string;
  vidRef: string;
  vidUnref: string;
  childFlowId: string;
}): { varRef: VariableInstance; varUnref: VariableInstance } {
  const { projectId, movedTaskId, vidRef, vidUnref, childFlowId } = params;
  const varRef: VariableInstance = {
    id: vidRef,
    taskInstanceId: movedTaskId,
    dataPath: 'p1',
    scope: 'flow',
    scopeFlowId: childFlowId,
  };
  const varUnref: VariableInstance = {
    id: vidUnref,
    taskInstanceId: movedTaskId,
    dataPath: 'p2',
    scope: 'flow',
    scopeFlowId: childFlowId,
  };
  rowsByProjectTask.set(kt(projectId, movedTaskId), [varRef, varUnref]);
  const svc = variableCreationService as unknown as {
    projectKey: (p: string) => string;
    store: Map<string, VariableInstance[]>;
  };
  svc.store.set(svc.projectKey(projectId), [varRef, varUnref]);
  setProjectTranslationsRegistry({
    [makeTranslationKey('var', vidRef)]: 'nome',
    [makeTranslationKey('var', vidUnref)]: 'cognome',
  });
  return { varRef, varUnref };
}

function buildScenario(): {
  params: ApplyTaskMoveToSubflowParams;
  vidRef: string;
  flowsTemplate: ApplyTaskMoveToSubflowParams['flows'];
} {
  const projectId = `proj_golden_${Math.random().toString(36).slice(2, 10)}`;
  const movedTaskId = `moved_${Math.random().toString(36).slice(2, 10)}`;
  const subflowTaskId = `portal_${Math.random().toString(36).slice(2, 10)}`;
  const parentFlowId = 'parent_flow';
  const childFlowId = 'child_flow';

  const vidRef = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const vidUnref = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  taskRepository.createTask(TaskType.SayMessage, null, {}, movedTaskId, projectId);
  taskRepository.createTask(
    TaskType.Subflow,
    null,
    { flowId: childFlowId, subflowBindingsSchemaVersion: 1, subflowBindings: [] },
    subflowTaskId,
    projectId
  );

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
  } as ApplyTaskMoveToSubflowParams['flows'];

  return {
    vidRef,
    flowsTemplate: flows,
    params: {
      projectId,
      parentFlowId,
      childFlowId,
      taskInstanceId: movedTaskId,
      subflowDisplayTitle: 'chiedi dati',
      parentSubflowTaskRowId: subflowTaskId,
      flows,
      skipMaterialization: true,
      skipStructuralPhase: true,
      isLinkedSubflowMove: true,
    },
  };
}

describe('applyTaskMoveToSubflow canonical vs legacy parity', () => {
  beforeEach(() => {
    rowsByProjectTask.clear();
    vi.spyOn(variableCreationService, 'hydrateVariablesFromFlow').mockImplementation(() => {});
    vi.spyOn(variableCreationService, 'getVariablesByTaskInstanceId').mockImplementation((pid, tid) => {
      return rowsByProjectTask.get(kt(String(pid), String(tid))) ?? [];
    });
    vi.spyOn(variableCreationService, 'getAllVariables').mockImplementation((pid) => {
      const rows: VariableInstance[] = [];
      for (const [key, v] of rowsByProjectTask) {
        if (key.startsWith(`${String(pid)}\0`)) rows.push(...v);
      }
      return rows;
    });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rowsByProjectTask.clear();
  });

  it('matches legacy flowsNext and result fields (registry + store re-seeded between runs)', () => {
    const spyRef = vi.spyOn(collectReferenced, 'collectReferencedVarIdsForParentFlowWorkspace');

    const { params, vidRef, flowsTemplate } = buildScenario();
    const childFlowId = params.childFlowId!;

    const resetPortalBindings = () => {
      taskRepository.updateTask(
        params.parentSubflowTaskRowId,
        { subflowBindings: [], subflowBindingsSchemaVersion: 1 },
        params.projectId,
        { merge: true, skipSubflowInterfaceSync: true }
      );
    };

    const runLegacy = () => {
      resetPortalBindings();
      seedRegistryAndStore({
        projectId: params.projectId,
        movedTaskId: params.taskInstanceId,
        vidRef,
        vidUnref: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        childFlowId,
      });
      spyRef.mockReturnValue(new Set([vidRef]));
      return applyTaskMoveToSubflowLegacy({
        ...params,
        flows: structuredClone(flowsTemplate) as ApplyTaskMoveToSubflowParams['flows'],
      });
    };

    const runCanonical = () => {
      resetPortalBindings();
      seedRegistryAndStore({
        projectId: params.projectId,
        movedTaskId: params.taskInstanceId,
        vidRef,
        vidUnref: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        childFlowId,
      });
      spyRef.mockReturnValue(new Set([vidRef]));
      return applyTaskMoveToSubflow({
        ...params,
        flows: structuredClone(flowsTemplate) as ApplyTaskMoveToSubflowParams['flows'],
      });
    };

    const legacy = runLegacy();
    const canonical = runCanonical();

    expect(canonical.flowsNext).toEqual(legacy.flowsNext);
    expect(canonical.referencedVarIdsForMovedTask).toEqual(legacy.referencedVarIdsForMovedTask);
    expect(canonical.unreferencedVarIdsForMovedTask).toEqual(legacy.unreferencedVarIdsForMovedTask);
    expect(canonical.guidMappingParentSubflow).toEqual(legacy.guidMappingParentSubflow);
    expect(canonical.removedUnreferencedVariableRows).toBe(legacy.removedUnreferencedVariableRows);
    expect(canonical.parentAutoRenames).toEqual(legacy.parentAutoRenames);
    expect(canonical.renamed).toEqual(legacy.renamed);
    expect(canonical.secondPassDisplayLabelUpdates).toBe(legacy.secondPassDisplayLabelUpdates);
  });
});
