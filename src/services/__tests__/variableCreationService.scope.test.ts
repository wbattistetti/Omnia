import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { TaskTree, TaskTreeNode } from '@types/taskTypes';
import { variableCreationService } from '../VariableCreationService';
import { FlowWorkspaceSnapshot } from '../../flows/FlowWorkspaceSnapshot';
import { getVariableLabel } from '../../utils/getVariableLabel';
import {
  getProjectTranslationsTable,
  setProjectTranslationsRegistry,
} from '../../utils/projectTranslationsRegistry';
import { getActiveFlowMetaTranslationsFlattened } from '../../utils/activeFlowTranslations';
import { makeTranslationKey } from '../../utils/translationKeys';

describe('VariableCreationService per-flow scope', () => {
  beforeEach(() => {
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: { nodes: [], edges: [], meta: { translations: {} } },
        sub1: { nodes: [], edges: [], meta: { translations: {} } },
      },
      'main'
    );
  });

  afterEach(() => {
    FlowWorkspaceSnapshot.setSnapshot({}, 'main');
  });

  it('project manual globals appear on every flow; flow-scoped manual only on matching canvas', () => {
    const pid = `vitest_scope_${Math.random().toString(36).slice(2, 12)}`;
    const g = variableCreationService.createManualVariable(pid, 'global_x');
    const vFlow = variableCreationService.createManualVariable(pid, 'flow_only', {
      scope: 'flow',
      scopeFlowId: 'sub1',
    });

    const mainNames = variableCreationService.getAllVarNames(pid, 'main');
    expect(mainNames).toContain(g.id);
    expect(mainNames).not.toContain(vFlow.id);

    const subNames = variableCreationService.getAllVarNames(pid, 'sub1');
    expect(subNames).toContain(g.id);
    expect(subNames).toContain(vFlow.id);

    expect(variableCreationService.removeVariableById(pid, vFlow.id)).toBe(true);
    expect(variableCreationService.getAllVarNames(pid, 'sub1')).not.toContain(vFlow.id);
  });

  it('task-bound variables appear only when that task row is on the flow canvas', () => {
    const pid = `vitest_taskscope_${Math.random().toString(36).slice(2, 12)}`;
    const taskRowId = 'task-row-a';
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: {
          nodes: [{ id: 'n1', data: { rows: [{ id: taskRowId, text: 'Ask' }] } } as any],
          edges: [],
          meta: { translations: {} },
        },
        other: { nodes: [], edges: [], meta: { translations: {} } },
      },
      'main'
    );

    const treeNodeId = '11111111-1111-4111-8111-111111111111';
    const roots: TaskTreeNode[] = [
      { id: treeNodeId, label: 'campo', subNodes: [], templateId: 't' } as TaskTreeNode,
    ];
    const taskTree: TaskTree = {
      labelKey: 'Ask',
      nodes: roots,
      steps: {},
    };
    variableCreationService.hydrateVariablesFromTaskTree(pid, 'main', taskRowId, taskTree);
    const trKey = makeTranslationKey('var', treeNodeId);
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: {
          nodes: [{ id: 'n1', data: { rows: [{ id: taskRowId, text: 'Ask' }] } } as any],
          edges: [],
          meta: { translations: { [trKey]: 'campo' } },
        },
        other: { nodes: [], edges: [], meta: { translations: {} } },
      },
      'main'
    );
    setProjectTranslationsRegistry({
      ...getProjectTranslationsTable(),
      [trKey]: 'campo',
    });

    const namesOnMain = variableCreationService.getAllVarNames(pid, 'main');
    expect(namesOnMain.length).toBeGreaterThan(0);

    expect(variableCreationService.getAllVarNames(pid, 'other').length).toBe(0);
  });

  it('renameManual updates label when no duplicate in bucket', () => {
    const pid = `vitest_rename_${Math.random().toString(36).slice(2, 12)}`;
    const v = variableCreationService.createManualVariable(pid, 'orig_name');
    const trKey = makeTranslationKey('var', v.id);
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: {
          nodes: [],
          edges: [],
          meta: { translations: { [trKey]: 'orig_name' } },
        },
      },
      'main'
    );
    setProjectTranslationsRegistry({ [trKey]: 'orig_name' });
    expect(variableCreationService.renameVariableById(pid, v.id, 'new_name')).toBe(true);
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: {
          nodes: [],
          edges: [],
          meta: { translations: { [trKey]: 'new_name' } },
        },
      },
      'main'
    );
    setProjectTranslationsRegistry({ [trKey]: 'new_name' });
    expect(getVariableLabel(v.id, getActiveFlowMetaTranslationsFlattened())).toBe('new_name');
  });

  it('getAllVarNames with undefined projectId resolves to default bucket; globals on all flows', () => {
    const suffix = Math.random().toString(36).slice(2, 10);
    const g = variableCreationService.createManualVariable(undefined, `g_${suffix}`);
    const f = variableCreationService.createManualVariable(undefined, `f_${suffix}`, {
      scope: 'flow',
      scopeFlowId: 'main',
    });
    const main = variableCreationService.getAllVarNames(undefined, 'main');
    expect(main).toContain(g.id);
    expect(main).toContain(f.id);
    const other = variableCreationService.getAllVarNames(undefined, 'other');
    expect(other).toContain(g.id);
    expect(other).not.toContain(f.id);
  });
});
