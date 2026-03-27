import { describe, expect, it } from 'vitest';
import { subflowInterfaceOutputMappingKey } from './subflowVariableMappingKey';
import {
  buildVariableMappingsFromMenu,
  getVariableMenuRebuildFingerprint,
  type VariableMenuItem,
} from './variableMenuModel';
import { convertDSLLabelsToGUIDs, convertDSLGUIDsToLabels } from '../../utils/conditionCodeConverter';

describe('buildVariableMappingsFromMenu', () => {
  it('registers both composite and child var id for Subflow interface items', () => {
    const childVarId = '2c3b419f-0c6b-4f5f-8d71-d784a7e9c617';
    const taskId = 'task-row-1';
    const items: VariableMenuItem[] = [
      {
        varId: childVarId,
        varLabel: 'nome',
        tokenLabel: 'dati personali.nome',
        ownerFlowId: 'child-flow',
        ownerFlowTitle: 'Child',
        isExposed: true,
        isFromActiveFlow: false,
        sourceTaskRowLabel: 'dati personali',
        subflowTaskId: taskId,
        isInterfaceUnbound: true,
      },
    ];
    const map = buildVariableMappingsFromMenu(items);
    const composite = subflowInterfaceOutputMappingKey(taskId, childVarId);
    expect(map.get(composite)).toBe('dati personali.nome');
    expect(map.get(childVarId)).toBe('dati personali.nome');
  });

  it('encode prefers composite key when preferKeysForEncode matches', () => {
    const composite = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const parentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const label = 'dati personali.nome';
    const map = new Map<string, string>([
      [parentId, label],
      [composite, label],
    ]);
    const encoded = convertDSLLabelsToGUIDs(`[${label}]`, map, {
      preferKeysForEncode: new Set([composite]),
    });
    expect(encoded).toBe(`[${composite}]`);
  });

  it('registers composite key for interface rows without child variableRefId (synthetic iface: id)', () => {
    const taskId = 'task-row-iface';
    const syntheticVarId = 'iface:me-123';
    const items: VariableMenuItem[] = [
      {
        varId: syntheticVarId,
        varLabel: 'nome',
        tokenLabel: 'dati personali.nome',
        ownerFlowId: 'child-flow',
        ownerFlowTitle: 'Child',
        isExposed: true,
        isFromActiveFlow: false,
        sourceTaskRowLabel: 'dati personali',
        subflowTaskId: taskId,
        isInterfaceUnbound: true,
        missingChildVariableRef: true,
      },
    ];
    const map = buildVariableMappingsFromMenu(items);
    const composite = subflowInterfaceOutputMappingKey(taskId, syntheticVarId);
    expect(map.get(composite)).toBe('dati personali.nome');
    expect(map.get(syntheticVarId)).toBe('dati personali.nome');
  });

  it('bound subflow outputs (parent var + subflowTaskId) register as plain parent id, not composite', () => {
    const parentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const taskId = 'subflow-row-1';
    const items: VariableMenuItem[] = [
      {
        varId: parentId,
        varLabel: 'nome',
        tokenLabel: 'nome',
        ownerFlowId: 'main-flow',
        ownerFlowTitle: 'Main',
        isExposed: true,
        isFromActiveFlow: true,
        sourceTaskRowLabel: 'dati personali',
        subflowTaskId: taskId,
        resolvedFromSubflowOutputBinding: true,
      },
    ];
    const map = buildVariableMappingsFromMenu(items);
    const composite = subflowInterfaceOutputMappingKey(taskId, parentId);
    expect(map.get(parentId)).toBe('nome');
    expect(map.get(composite)).toBeUndefined();
  });

  it('decode resolves raw child var id from map', () => {
    const childVarId = '2c3b419f-0c6b-4f5f-8d71-d784a7e9c617';
    const taskId = 'task-row-1';
    const items: VariableMenuItem[] = [
      {
        varId: childVarId,
        varLabel: 'nome',
        tokenLabel: 'dati personali.nome',
        ownerFlowId: 'child-flow',
        ownerFlowTitle: 'Child',
        isExposed: true,
        isFromActiveFlow: false,
        sourceTaskRowLabel: 'dati personali',
        subflowTaskId: taskId,
        isInterfaceUnbound: true,
      },
    ];
    const map = buildVariableMappingsFromMenu(items);
    const decoded = convertDSLGUIDsToLabels(`[${childVarId}]`, map);
    expect(decoded).toBe('[dati personali.nome]');
  });
});

describe('getVariableMenuRebuildFingerprint', () => {
  it('matches for identical flow data even when flows object is new', () => {
    const flowsA = { main: { nodes: [{ id: 'n1' }], meta: { x: 1 } } };
    const flowsB = { main: { nodes: [{ id: 'n1' }], meta: { x: 1 } } };
    expect(getVariableMenuRebuildFingerprint(flowsA as any, 'main')).toBe(
      getVariableMenuRebuildFingerprint(flowsB as any, 'main')
    );
  });

  it('changes when root flow nodes change', () => {
    const before = { main: { nodes: [], meta: {} } };
    const after = { main: { nodes: [{ id: 'n1' }], meta: {} } };
    expect(getVariableMenuRebuildFingerprint(before as any, 'main')).not.toBe(
      getVariableMenuRebuildFingerprint(after as any, 'main')
    );
  });
});
