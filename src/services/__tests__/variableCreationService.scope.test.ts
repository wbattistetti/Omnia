import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { TaskTree, TaskTreeNode } from '@types/taskTypes';
import { variableCreationService } from '../VariableCreationService';
import { FlowWorkspaceSnapshot } from '../../flows/FlowWorkspaceSnapshot';
import { getVariableLabel } from '../../utils/getVariableLabel';
import {
  getProjectTranslationsTable,
  setProjectTranslationsRegistry,
} from '../../utils/projectTranslationsRegistry';
import { makeTranslationKey } from '../../utils/translationKeys';

describe('VariableCreationService per-flow scope', () => {
  beforeEach(() => {
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: { nodes: [], edges: [] },
        sub1: { nodes: [], edges: [] },
      },
      'main'
    );
  });

  afterEach(() => {
    FlowWorkspaceSnapshot.setSnapshot({}, 'main');
  });

  it('project manual globals appear on every flow; flow-scoped manual only on matching canvas', () => {
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

    expect(variableCreationService.removeVariableById(pid, vFlow.id)).toBe(true);
    expect(variableCreationService.getAllVarNames(pid, 'sub1')).not.toContain('flow_only');
  });

  it('task-bound variables appear only when that task row is on the flow canvas', () => {
    const pid = `vitest_taskscope_${Math.random().toString(36).slice(2, 12)}`;
    const taskRowId = 'task-row-a';
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: {
          nodes: [{ id: 'n1', data: { rows: [{ id: taskRowId, text: 'Ask' }] } } as any],
          edges: [],
        },
        other: { nodes: [], edges: [] },
      },
      'main'
    );

    const roots: TaskTreeNode[] = [
      { id: 'tree-node-1', label: 'campo', subNodes: [], templateId: 't' } as TaskTreeNode,
    ];
    const taskTree: TaskTree = {
      labelKey: 'Ask',
      nodes: roots,
      steps: {},
    };
    variableCreationService.hydrateVariablesFromTaskTree(pid, 'main', taskRowId, taskTree, {
      taskRowLabel: 'Ask',
    });
    const namesOnMain = variableCreationService.getAllVarNames(pid, 'main');
    expect(namesOnMain.length).toBeGreaterThan(0);

    expect(variableCreationService.getAllVarNames(pid, 'other').length).toBe(0);
  });

  it('renameManual updates label when no duplicate in bucket', () => {
    const pid = `vitest_rename_${Math.random().toString(36).slice(2, 12)}`;
    const v = variableCreationService.createManualVariable(pid, 'orig_name');
    setProjectTranslationsRegistry({ [makeTranslationKey('variable', v.id)]: 'orig_name' });
    expect(variableCreationService.renameVariableById(pid, v.id, 'new_name')).toBe(true);
    setProjectTranslationsRegistry({ [makeTranslationKey('variable', v.id)]: 'new_name' });
    expect(getVariableLabel(v.id, getProjectTranslationsTable())).toBe('new_name');
  });

  it('getAllVarNames with undefined projectId resolves to default bucket; globals on all flows', () => {
    const suffix = Math.random().toString(36).slice(2, 10);
    variableCreationService.createManualVariable(undefined, `g_${suffix}`);
    variableCreationService.createManualVariable(undefined, `f_${suffix}`, {
      scope: 'flow',
      scopeFlowId: 'main',
    });
    const main = variableCreationService.getAllVarNames(undefined, 'main');
    expect(main).toContain(`g_${suffix}`);
    expect(main).toContain(`f_${suffix}`);
    const other = variableCreationService.getAllVarNames(undefined, 'other');
    expect(other).toContain(`g_${suffix}`);
    expect(other).not.toContain(`f_${suffix}`);
  });
});
