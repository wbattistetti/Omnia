import { describe, expect, it, afterEach } from 'vitest';
import { variableCreationService } from '@services/VariableCreationService';
import { mergeConditionEditorVariablesWithLiveFlowchart } from '../conditionEditorLiveVariables';
import { setCurrentProjectId } from '../../../state/runtime';

describe('mergeConditionEditorVariablesWithLiveFlowchart', () => {
  afterEach(() => {
    setCurrentProjectId(null);
  });

  it('overlays live flowchart variable names onto tab snapshot', () => {
    const pid = `vitest_ce_${Math.random().toString(36).slice(2, 12)}`;
    setCurrentProjectId(pid);
    variableCreationService.createManualVariable(pid, 'from_store', {
      scope: 'flow',
      scopeFlowId: 'main',
    });

    const merged = mergeConditionEditorVariablesWithLiveFlowchart(null, 'main', { old: '' });
    expect(merged.from_store).toBe('');
    expect(merged.old).toBe('');
  });

  it('shows variables when tab projectId is absent but runtime has no project (default bucket)', () => {
    setCurrentProjectId(null);
    const suffix = Math.random().toString(36).slice(2, 10);
    variableCreationService.createManualVariable(undefined, `def_${suffix}`, {
      scope: 'flow',
      scopeFlowId: 'main',
    });
    const merged = mergeConditionEditorVariablesWithLiveFlowchart(undefined, 'main', {});
    expect(merged[`def_${suffix}`]).toBe('');
  });
});
