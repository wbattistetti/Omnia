import { describe, expect, it } from 'vitest';
import { subflowInterfaceOutputMappingKey } from './subflowVariableMappingKey';
import { buildVariableMappingsFromMenu, type VariableMenuItem } from './variableMenuModel';
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
