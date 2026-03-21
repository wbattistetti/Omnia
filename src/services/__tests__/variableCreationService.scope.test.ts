import { describe, expect, it } from 'vitest';
import { variableCreationService } from '../VariableCreationService';

describe('VariableCreationService manual scope', () => {
  it('project manual vars visible on all flows; flow-scoped only on matching canvas', () => {
    const pid = `vitest_scope_${Math.random().toString(36).slice(2, 12)}`;
    variableCreationService.createManualVariable(pid, 'global_x');
    const vFlow = variableCreationService.createManualVariable(pid, 'flow_only', {
      scope: 'flow',
      scopeFlowId: 'sub1',
    });

    const mainNames = variableCreationService.getAllVarNames(pid, 'main');
    expect(mainNames).toContain('global_x');
    expect(mainNames).not.toContain('flow_only');

    const subNames = variableCreationService.getAllVarNames(pid, 'sub1');
    expect(subNames).toContain('global_x');
    expect(subNames).toContain('flow_only');

    expect(variableCreationService.removeVariableByVarId(pid, vFlow.varId)).toBe(true);
    expect(variableCreationService.getAllVarNames(pid, 'sub1')).not.toContain('flow_only');
  });

  it('renameManual updates label when no duplicate in bucket', () => {
    const pid = `vitest_rename_${Math.random().toString(36).slice(2, 12)}`;
    const v = variableCreationService.createManualVariable(pid, 'orig_name');
    expect(variableCreationService.renameVariableByVarId(pid, v.varId, 'new_name')).toBe(true);
    expect(variableCreationService.getVarNameByVarId(pid, v.varId)).toBe('new_name');
  });
});
