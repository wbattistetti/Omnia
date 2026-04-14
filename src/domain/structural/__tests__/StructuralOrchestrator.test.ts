import { describe, expect, it, vi } from 'vitest';
import { variableCreationService } from '@services/VariableCreationService';
import { runStructuralCommandSync, createDefaultStructuralOrchestratorContext } from '../StructuralOrchestrator';
import { newCommandId } from '../commands';
import * as reconcileMod from '../reconcileVariableStore';
import * as applyMod from '@domain/taskSubflowMove/applyTaskMoveToSubflow';

describe('StructuralOrchestrator', () => {
  it('moveTaskRow aborts with minimal result when ids are incomplete', () => {
    const ctx = {
      projectId: 'p1',
      getFlows: () => ({}),
      commitFlowSlices: vi.fn(() => true),
    };
    const out = runStructuralCommandSync(ctx, {
      type: 'moveTaskRow',
      commandId: newCommandId(),
      source: 'menu',
      rowId: '',
      fromFlowId: 'main',
      toFlowId: 'main',
      fromNodeId: 'n1',
      toNodeId: 'n2',
    }) as { flowsNext: unknown };
    expect(out.flowsNext).toEqual({});
  });

  it('runs reconcile before applyTaskMoveToSubflow for moveTaskRowIntoSubflow (order)', () => {
    const order: string[] = [];
    const reconcileSpy = vi.spyOn(reconcileMod, 'reconcileUtteranceVariableStoreWithFlowGraph').mockImplementation(() => {
      order.push('reconcile');
    });
    const varsSpy = vi.spyOn(variableCreationService, 'getVariablesByTaskInstanceId').mockReturnValue([
      { id: 'var-1' } as any,
    ]);
    const applySpy = vi.spyOn(applyMod, 'applyTaskMoveToSubflow').mockReturnValue({
      referencedVarIdsForMovedTask: [],
      unreferencedVarIdsForMovedTask: [],
      guidMappingParentSubflow: [],
      renamed: [],
      parentAutoRenames: [],
      removedUnreferencedVariableRows: 0,
      taskMaterialization: {
        ok: true,
        parentFlowContainedRowBeforeStrip: false,
        parentFlowContainsRowAfter: false,
        childFlowContainsRow: true,
        taskFoundInRepository: true,
        repositoryPatchApplied: false,
      },
      secondPassDisplayLabelUpdates: 0,
      flowsNext: {
        main: { id: 'main', nodes: [], edges: [] },
        child: { id: 'child', nodes: [], edges: [], meta: { flowInterface: { input: [], output: [] } } },
      },
    } as any);
    try {
      const ctx = {
        ...createDefaultStructuralOrchestratorContext('p1'),
        getFlows: () => ({
          main: {
            id: 'main',
            nodes: [{ id: 'n1', data: { rows: [{ id: 'taskRow', text: 't' }] } }],
            edges: [],
          },
          child: {
            id: 'child',
            title: 'C',
            nodes: [{ id: 'cn', data: { rows: [] } }],
            edges: [],
            meta: { flowInterface: { input: [], output: [] } },
          },
        }),
        commitFlowSlices: vi.fn(() => true),
        projectData: {},
        getTranslations: () => ({}),
      };
      runStructuralCommandSync(ctx, {
        type: 'moveTaskRowIntoSubflow',
        commandId: newCommandId(),
        source: 'portal',
        rowId: 'taskRow',
        rowData: { id: 'taskRow', text: 'x' } as any,
        parentFlowId: 'main',
        childFlowId: 'child',
        targetNodeId: 'cn',
        parentSubflowTaskRowId: 'sfPortal',
        subflowDisplayTitle: 'S',
      });
      expect(order).toEqual(['reconcile']);
      expect(applySpy).toHaveBeenCalled();
      expect(reconcileSpy.mock.invocationCallOrder[0]).toBeLessThan(applySpy.mock.invocationCallOrder[0]);
    } finally {
      reconcileSpy.mockRestore();
      applySpy.mockRestore();
      varsSpy.mockRestore();
    }
  });
});
