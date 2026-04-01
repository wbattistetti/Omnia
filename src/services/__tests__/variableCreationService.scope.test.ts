import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { TaskTreeNode } from '@types/taskTypes';
import { variableCreationService } from '../VariableCreationService';
import { FlowWorkspaceSnapshot } from '../../flows/FlowWorkspaceSnapshot';

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

  it('project manual vars are not listed per-flow; flow-scoped only on matching canvas', () => {
    const pid = `vitest_scope_${Math.random().toString(36).slice(2, 12)}`;
    variableCreationService.createManualVariable(pid, 'global_x');
    const vFlow = variableCreationService.createManualVariable(pid, 'flow_only', {
      scope: 'flow',
      scopeFlowId: 'sub1',
    });

    const mainNames = variableCreationService.getAllVarNames(pid, 'main');
    expect(mainNames).not.toContain('global_x');
    expect(mainNames).not.toContain('flow_only');

    const subNames = variableCreationService.getAllVarNames(pid, 'sub1');
    expect(subNames).not.toContain('global_x');
    expect(subNames).toContain('flow_only');

    expect(variableCreationService.removeVariableByVarId(pid, vFlow.varId)).toBe(true);
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
    variableCreationService.syncUtteranceTaskTreeVariables(pid, taskRowId, 'Ask', roots);
    const namesOnMain = variableCreationService.getAllVarNames(pid, 'main');
    expect(namesOnMain.length).toBeGreaterThan(0);

    expect(variableCreationService.getAllVarNames(pid, 'other').length).toBe(0);
  });

  it('renameManual updates label when no duplicate in bucket', () => {
    const pid = `vitest_rename_${Math.random().toString(36).slice(2, 12)}`;
    const v = variableCreationService.createManualVariable(pid, 'orig_name');
    expect(variableCreationService.renameVariableByVarId(pid, v.varId, 'new_name')).toBe(true);
    expect(variableCreationService.getVarNameByVarId(pid, v.varId)).toBe('new_name');
  });
});
