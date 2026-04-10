import { describe, expect, it, vi } from 'vitest';
import { applyTaskMoveToSubflow, mergeChildFlowInterfaceOutputsForVariables } from '../applyTaskMoveToSubflow';
import * as materializeModule from '../materializeTaskInSubflow';
import type { VariableInstance } from '@types/variableTypes';

describe('mergeChildFlowInterfaceOutputsForVariables', () => {
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
        varName: 'nome',
        taskInstanceId: 'task1',
        dataPath: 'p',
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        varName: 'cognome',
        taskInstanceId: 'task1',
        dataPath: 'p2',
      },
    ];

    const next = mergeChildFlowInterfaceOutputsForVariables(flows, 'sf', vars, {
      onlyVarIds: new Set(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']),
    });

    const out = (next.sf.meta as any).flowInterface.output as Array<{
      variableRefId?: string;
      linkedVariable?: string;
      externalName?: string;
    }>;
    expect(out.length).toBe(1);
    expect(out[0].variableRefId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(out[0].linkedVariable).toBe('nome');
    expect(out[0].externalName).toBe('nome');
  });

  it('when onlyVarIds is empty Set, exposes all task variables (parent scan fallback)', () => {
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
        varName: 'nome',
        taskInstanceId: 'task1',
        dataPath: 'p',
      },
    ];

    const next = mergeChildFlowInterfaceOutputsForVariables(flows, 'sf', vars, {
      onlyVarIds: new Set(),
    });

    const out = (next.sf.meta as any).flowInterface.output;
    expect(out.length).toBe(1);
    expect(out[0].variableRefId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('child varName local (colore): OUTPUT shows only colore; internalPath is not parent FQ', () => {
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
        varName: 'colore',
        taskInstanceId: 'task1',
        dataPath: 'p',
      },
    ];

    const next = mergeChildFlowInterfaceOutputsForVariables(flows, 'sf', vars, {
      onlyVarIds: new Set(['5802a057-bb1a-4c93-9e86-2000bc770f47']),
    });

    const out = (next.sf.meta as any).flowInterface.output as Array<{
      externalName?: string;
      linkedVariable?: string;
      internalPath?: string;
    }>;
    expect(out.length).toBe(1);
    expect(out[0].externalName).toBe('colore');
    expect(out[0].linkedVariable).toBe('colore');
    expect(out[0].internalPath).toBe('colore');
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
