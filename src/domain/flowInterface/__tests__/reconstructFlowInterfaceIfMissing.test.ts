import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildSubflowInterfaceView,
  buildOutputMappingEntriesForChildFlow,
  canBuildSubflowInterfaceFromFlowSlice,
} from '../reconstructFlowInterfaceIfMissing';
import { variableCreationService } from '@services/VariableCreationService';

vi.mock('@services/VariableCreationService', () => ({
  variableCreationService: {
    getVariablesForFlowScope: vi.fn(),
  },
}));

const flows = { sf1: { id: 'sf1', title: 'SF', nodes: [], edges: [] } };

const ID_NOME = '11111111-1111-1111-1111-111111111111';
const ID_COG = '22222222-2222-2222-2222-222222222222';

function inst(id: string, taskInstanceId: string): any {
  return { id, varName: `n_${id.slice(0, 4)}`, taskInstanceId, dataPath: '', scope: 'flow', scopeFlowId: 'sf1' };
}

describe('canBuildSubflowInterfaceFromFlowSlice', () => {
  it('is false when hydrated is false', () => {
    expect(
      canBuildSubflowInterfaceFromFlowSlice({
        id: 'x',
        title: 't',
        nodes: [],
        edges: [],
        hydrated: false,
        variablesReady: true,
      } as any)
    ).toBe(false);
  });

  it('is false when variablesReady is false', () => {
    expect(
      canBuildSubflowInterfaceFromFlowSlice({
        id: 'x',
        title: 't',
        nodes: [],
        edges: [],
        hydrated: true,
        variablesReady: false,
      } as any)
    ).toBe(false);
  });

  it('is true when both hydrated and variablesReady are true', () => {
    expect(
      canBuildSubflowInterfaceFromFlowSlice({
        id: 'x',
        title: 't',
        nodes: [],
        edges: [],
        hydrated: true,
        variablesReady: true,
      } as any)
    ).toBe(true);
  });
});

describe('subflow interface view (getVariablesForFlowScope + S2)', () => {
  beforeEach(() => {
    vi.mocked(variableCreationService.getVariablesForFlowScope).mockReset();
  });

  it('builds OUTPUT from scope instances and INPUT from bindings (order preserved)', () => {
    vi.mocked(variableCreationService.getVariablesForFlowScope).mockReturnValue([inst(ID_NOME, 't1'), inst(ID_COG, 't2')]);

    const r = buildSubflowInterfaceView({
      projectId: 'p1',
      childFlowId: 'sf1',
      subflowTask: {
        subflowBindings: [
          { interfaceParameterId: ID_COG, parentVariableId: 'p2' },
          { interfaceParameterId: ID_NOME, parentVariableId: 'p1' },
        ],
      },
      translations: { [`variable:${ID_NOME}`]: 'Nome', [`variable:${ID_COG}`]: 'Cognome' },
      workspaceFlows: flows as any,
    });
    expect(r.output.length).toBe(2);
    expect(r.input.map((x) => x.variableRefId)).toEqual([ID_COG, ID_NOME]);
    expect(variableCreationService.getVariablesForFlowScope).toHaveBeenCalledWith('p1', 'sf1', flows);
  });

  it('throws if binding references a variable not in child flow scope', () => {
    vi.mocked(variableCreationService.getVariablesForFlowScope).mockReturnValue([inst('only', 't1')]);

    expect(() =>
      buildSubflowInterfaceView({
        projectId: 'p1',
        childFlowId: 'sf1',
        subflowTask: {
          subflowBindings: [{ interfaceParameterId: 'missing', parentVariableId: 'p' }],
        },
        translations: {},
        workspaceFlows: flows as any,
      })
    ).toThrow(/interfaceParameterId/);
  });

  it('buildOutputMappingEntriesForChildFlow uses getVariablesForFlowScope', () => {
    vi.mocked(variableCreationService.getVariablesForFlowScope).mockReturnValue([inst('a', 't1'), inst('b', 't2')]);
    const out = buildOutputMappingEntriesForChildFlow('p1', 'sf1', flows as any, {
      'variable:a': 'A',
      'variable:b': 'B',
    });
    expect(out.length).toBe(2);
    expect(out.map((e) => e.variableRefId).sort()).toEqual(['a', 'b']);
  });
});
