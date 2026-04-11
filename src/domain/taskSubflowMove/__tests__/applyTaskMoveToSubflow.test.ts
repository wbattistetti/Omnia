import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { TaskType } from '@types/taskTypes';
import type { VariableInstance } from '@types/variableTypes';
import { makeTranslationKey } from '@utils/translationKeys';
import { setProjectTranslationsRegistry } from '@utils/projectTranslationsRegistry';
import * as collectReferenced from '../collectReferencedVarIds';
import { applyTaskMoveToSubflow, mergeChildFlowInterfaceOutputsForVariables } from '../applyTaskMoveToSubflow';
import * as materializeModule from '../materializeTaskInSubflow';

describe('mergeChildFlowInterfaceOutputsForVariables', () => {
  beforeEach(() => {
    setProjectTranslationsRegistry({
      [makeTranslationKey('var', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')]: 'nome',
      [makeTranslationKey('var', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')]: 'cognome',
      [makeTranslationKey('var', '5802a057-bb1a-4c93-9e86-2000bc770f47')]: 'colore',
    });
  });

  it('adds only varIds in onlyVarIds when set', () => {
    const flows = {
      sf: {
        id: 'sf',
        title: 'Sub',
        nodes: [],
        edges: [],
        meta: { flowInterface: { input: [], output: [] } },
      },
    } as any;

    const vars: VariableInstance[] = [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        taskInstanceId: 'task1',
        dataPath: 'p',
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        taskInstanceId: 'task1',
        dataPath: 'p2',
      },
    ];

    const next = mergeChildFlowInterfaceOutputsForVariables(flows, 'sf', vars, {
      onlyVarIds: new Set(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']),
    });

    const vid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const out = (next.sf.meta as any).flowInterface.output as Array<{
      variableRefId?: string;
      labelKey?: string;
    }>;
    const tr = (next.sf.meta as any).translations as Record<string, string>;
    expect(out.length).toBe(1);
    expect(out[0].variableRefId).toBe(vid);
    expect(out[0].labelKey).toBe(makeTranslationKey('interface', vid));
    expect(tr[makeTranslationKey('interface', vid)]).toBe('nome');
  });

  it('when onlyVarIds is empty Set, exposes no outputs (explicit referenced-only scan empty)', () => {
    const flows = {
      sf: {
        id: 'sf',
        nodes: [],
        edges: [],
        meta: { flowInterface: { input: [], output: [] } },
      },
    } as any;

    const vars: VariableInstance[] = [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        taskInstanceId: 'task1',
        dataPath: 'p',
      },
    ];

    const next = mergeChildFlowInterfaceOutputsForVariables(flows, 'sf', vars, {
      onlyVarIds: new Set(),
    });

    const out = (next.sf.meta as any).flowInterface.output;
    expect(out.length).toBe(0);
  });

  it('child local label (colore): OUTPUT row has wireKey slug for mapping tree + interface translation', () => {
    const flows = {
      sf: {
        id: 'sf',
        title: 'Sub',
        nodes: [],
        edges: [],
        meta: { flowInterface: { input: [], output: [] } },
      },
    } as any;

    const vars: VariableInstance[] = [
      {
        id: '5802a057-bb1a-4c93-9e86-2000bc770f47',
        taskInstanceId: 'task1',
        dataPath: 'p',
      },
    ];

    const next = mergeChildFlowInterfaceOutputsForVariables(flows, 'sf', vars, {
      onlyVarIds: new Set(['5802a057-bb1a-4c93-9e86-2000bc770f47']),
    });

    const vid = '5802a057-bb1a-4c93-9e86-2000bc770f47';
    const out = (next.sf.meta as any).flowInterface.output as Array<{
      variableRefId?: string;
      labelKey?: string;
      wireKey?: string;
    }>;
    const tr = (next.sf.meta as any).translations as Record<string, string>;
    expect(out.length).toBe(1);
    expect(out[0].variableRefId).toBe(vid);
    expect(out[0].wireKey ?? '').toBe('colore');
    expect(out[0].labelKey).toBe(makeTranslationKey('interface', vid));
    expect(tr[makeTranslationKey('interface', vid)]).toBe('colore');
  });
});

describe('applyTaskMoveToSubflow referenced-only S2 (linked)', () => {
  beforeEach(() => {
    vi.spyOn(variableCreationService, 'hydrateVariablesFromFlow').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renames and exposes only referenced vars; removes unreferenced task variable rows', () => {
    const projectId = `proj_s2ref_${Math.random().toString(36).slice(2, 10)}`;
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

    vi.spyOn(collectReferenced, 'collectReferencedVarIdsForParentFlowWorkspace').mockReturnValue(new Set([vidRef]));

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

    vi.spyOn(variableCreationService, 'getVariablesByTaskInstanceId').mockReturnValue([varRef, varUnref]);
    vi.spyOn(variableCreationService, 'getAllVariables').mockReturnValue([varRef, varUnref]);
    const svc = variableCreationService as unknown as {
      projectKey: (p: string) => string;
      store: Map<string, VariableInstance[]>;
    };
    svc.store.set(svc.projectKey(projectId), [varRef, varUnref]);

    setProjectTranslationsRegistry({
      [makeTranslationKey('var', vidRef)]: 'nome',
      [makeTranslationKey('var', vidUnref)]: 'cognome',
    });

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
      isLinkedSubflowMove: true,
    });

    expect(result.referencedVarIdsForMovedTask).toEqual([vidRef]);
    expect(result.unreferencedVarIdsForMovedTask).toContain(vidUnref);
    expect(result.removedUnreferencedVariableRows).toBeGreaterThanOrEqual(1);

    expect(result.guidMappingParentSubflow.map((g) => g.id)).toEqual([vidRef]);

    const outs = (result.flowsNext[childFlowId]?.meta as { flowInterface?: { output?: unknown[] } })?.flowInterface
      ?.output as Array<{ variableRefId?: string }>;
    expect(outs?.length).toBe(1);
    expect(String(outs[0]?.variableRefId)).toBe(vidRef);

    expect(result.parentAutoRenames.length).toBe(1);
    expect(result.parentAutoRenames[0]?.id).toBe(vidRef);
    expect(result.parentAutoRenames[0]?.nextName).toBe('dati.nome');

    const ptr = (result.flowsNext[parentFlowId]?.meta as { translations?: Record<string, string> } | undefined)
      ?.translations;
    expect(ptr?.[makeTranslationKey('var', vidRef)]).toBe('dati.nome');

    const portal = taskRepository.getTask(subflowTaskId);
    expect(portal?.subflowBindings?.length).toBe(1);
    expect(String(portal?.subflowBindings?.[0]?.interfaceParameterId)).toBe(vidRef);
  });
});

describe('applyTaskMoveToSubflow skipMaterialization', () => {
  it('does not call materializeMovedTaskForSubflow when skipMaterialization is true', () => {
    const spy = vi.spyOn(materializeModule, 'materializeMovedTaskForSubflow').mockReturnValue({
      flowsNext: {},
      ok: true,
      parentFlowContainedRowBeforeStrip: false,
      parentFlowContainsRowAfter: false,
      childFlowContainsRow: true,
      taskFoundInRepository: true,
      repositoryPatchApplied: true,
    });
    try {
      applyTaskMoveToSubflow({
        projectId: 'p',
        parentFlowId: 'main',
        childFlowId: 'child',
        taskInstanceId: 't1',
        subflowDisplayTitle: 'S',
        parentSubflowTaskRowId: 'row1',
        flows: {
          main: { id: 'main', title: 'M', nodes: [], edges: [] },
          child: {
            id: 'child',
            title: 'C',
            nodes: [],
            edges: [],
            meta: { flowInterface: { input: [], output: [] } },
          },
        } as any,
        skipMaterialization: true,
      });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
