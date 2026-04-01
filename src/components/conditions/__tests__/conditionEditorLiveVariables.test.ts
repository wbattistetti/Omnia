import { describe, expect, it } from 'vitest';
import { variableCreationService } from '@services/VariableCreationService';
import { mergeConditionEditorVariablesWithLiveFlowchart } from '../conditionEditorLiveVariables';

describe('mergeConditionEditorVariablesWithLiveFlowchart', () => {
  it('overlays live flowchart variable names onto tab snapshot', () => {
    const pid = `vitest_ce_${Math.random().toString(36).slice(2, 12)}`;
    variableCreationService.createManualVariable(pid, 'from_store', {
      scope: 'flow',
      scopeFlowId: 'main',
    });

    const merged = mergeConditionEditorVariablesWithLiveFlowchart(pid, 'main', { old: '' });
    expect(merged.from_store).toBe('');
    expect(merged.old).toBe('');
  });
});
