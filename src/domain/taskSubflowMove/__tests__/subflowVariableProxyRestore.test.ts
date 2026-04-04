import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { variableCreationService } from '@services/VariableCreationService';
import { getVariableLabel } from '@utils/getVariableLabel';
import {
  getProjectTranslationsTable,
  setProjectTranslationsRegistry,
} from '@utils/projectTranslationsRegistry';
import { makeTranslationKey } from '@utils/translationKeys';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import type { TaskTree, TaskTreeNode } from '@types/taskTypes';
import {
  findParentFlowIdForSubflowTaskRow,
  migrateSubflowVariableProxyModel,
  restoreChildTaskBoundVariablesToLocalNames,
} from '../subflowVariableProxyRestore';
import * as subflowProjectSync from '@services/subflowProjectSync';

describe('findParentFlowIdForSubflowTaskRow', () => {
  it('returns parent flow id containing the subflow task row', () => {
    const flows = {
      main: {
        id: 'main',
        nodes: [
          {
            data: {
              rows: [{ id: 'subflow-row-1', text: 'My Sub' }],
            },
          },
        ],
      },
      other: { id: 'other', nodes: [] },
    } as any;
    expect(findParentFlowIdForSubflowTaskRow('subflow-row-1', flows)).toBe('main');
    expect(findParentFlowIdForSubflowTaskRow('missing', flows)).toBe(null);
  });
});

describe('restoreChildTaskBoundVariablesToLocalNames', () => {
  it('strips legacy FQ on child task-bound rows; never applies FQ', () => {
    const projectId = `vitest_restore_${Math.random().toString(36).slice(2, 14)}`;
    const taskId = 'task-restore-1';
    const nodeId = 'a0000000-0000-4000-8000-0000000000a1';
    const roots: TaskTreeNode[] = [
      { id: nodeId, label: 'campo', subNodes: [], templateId: 't1' } as TaskTreeNode,
    ];
    const taskTree: TaskTree = {
      labelKey: 'Ask field',
      nodes: roots,
      steps: {},
    };
    variableCreationService.hydrateVariablesFromTaskTree(projectId, 'main', taskId, taskTree, {
      taskRowLabel: 'Ask field',
    });
    const vars = variableCreationService.getVariablesByTaskInstanceId(projectId, taskId);
    expect(vars.length).toBeGreaterThan(0);
    const vid = vars[0]!.id;

    variableCreationService.renameVariableRowById(projectId, vid, 'dati_personali.colore');

    const renamed = restoreChildTaskBoundVariablesToLocalNames(projectId, taskId, new Set([vid]));
    expect(renamed.length).toBe(1);
    expect(renamed[0]!.previousName).toBe('dati_personali.colore');
    expect(renamed[0]!.nextName).toMatch(/colore/i);

    setProjectTranslationsRegistry({ [makeTranslationKey('variable', vid)]: renamed[0]!.nextName });
    const after = getVariableLabel(vid, getProjectTranslationsTable());
    expect(after).toBe(renamed[0]!.nextName);
    expect(after?.includes('.')).toBe(false);
  });
});

describe('migrateSubflowVariableProxyModel', () => {
  const syncSpy = vi.spyOn(subflowProjectSync, 'syncProxyBindingsForSubflowTask');

  beforeEach(() => {
    syncSpy.mockClear();
  });

  afterEach(() => {
    syncSpy.mockRestore();
  });

  it('renames child slot vars referenced in outputBindings and invokes sync', () => {
    const projectId = `vitest_mig_${Math.random().toString(36).slice(2, 14)}`;
    const childFlowId = 'child_f1';
    const parentFlowId = 'parent_f1';
    const subflowTaskId = `subflow-task-m1-${Math.random().toString(36).slice(2, 8)}`;
    const childTaskId = `utter-task-m1-${Math.random().toString(36).slice(2, 8)}`;

    const nodeIdB = 'b0000000-0000-4000-8000-0000000000b1';
    const roots: TaskTreeNode[] = [
      { id: nodeIdB, label: 'colore', subNodes: [], templateId: 't1' } as TaskTreeNode,
    ];
    const childTaskTree: TaskTree = {
      labelKey: 'Chiedi',
      nodes: roots,
      steps: {},
    };
    variableCreationService.hydrateVariablesFromTaskTree(projectId, childFlowId, childTaskId, childTaskTree, {
      taskRowLabel: 'Chiedi',
    });
    const vars = variableCreationService.getVariablesByTaskInstanceId(projectId, childTaskId);
    const childVarId = vars[0]!.id;
    variableCreationService.renameVariableRowById(projectId, childVarId, 'dati_personali.colore');

    const parentProxy = variableCreationService.createManualVariable(projectId, 'dati_personali.colore', {
      scope: 'flow',
      scopeFlowId: parentFlowId,
    });

    taskRepository.createTask(TaskType.Subflow, null, undefined, subflowTaskId, projectId);
    taskRepository.updateTask(subflowTaskId, {
      flowId: childFlowId,
      outputBindings: [{ fromVariable: childVarId, toVariable: parentProxy.id }],
    } as any);

    const flows = {
      [parentFlowId]: {
        id: parentFlowId,
        nodes: [{ data: { rows: [{ id: subflowTaskId, text: 'Chiedi dati' }] } }],
      },
      [childFlowId]: {
        id: childFlowId,
        meta: {
          flowInterface: {
            output: [
              {
                variableRefId: childVarId,
                internalPath: 'colore',
                externalName: 'colore',
                linkedVariable: 'colore',
              },
            ],
          },
        },
      },
    } as any;

    const r = migrateSubflowVariableProxyModel(projectId, flows);

    expect(r.childRenames.length).toBe(1);
    expect(r.childRenames[0]!.id).toBe(childVarId);
    setProjectTranslationsRegistry({ [makeTranslationKey('variable', childVarId)]: 'colore' });
    expect(getVariableLabel(childVarId, getProjectTranslationsTable())).toBe('colore');
    expect(r.syncCalls).toBe(1);
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });
});
