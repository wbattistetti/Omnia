import { describe, expect, it } from 'vitest';
import { variableCreationService } from '@services/VariableCreationService';
import { getVariableLabel } from '@utils/getVariableLabel';
import { FlowWorkspaceSnapshot } from '@flows/FlowWorkspaceSnapshot';
import { getActiveFlowMetaTranslationsFlattened } from '@utils/activeFlowTranslations';
import { setProjectTranslationsRegistry } from '@utils/projectTranslationsRegistry';
import { makeTranslationKey } from '@utils/translationKeys';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import type { TaskTree, TaskTreeNode } from '@types/taskTypes';
import {
  findParentFlowIdForSubflowTaskRow,
  migrateSubflowVariableProxyModel,
  restoreChildTaskBoundVariablesToLocalNames,
} from '../subflowVariableProxyRestore';

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
    variableCreationService.hydrateVariablesFromTaskTree(projectId, 'main', taskId, taskTree);
    setProjectTranslationsRegistry({
      [makeTranslationKey('var', nodeId)]: 'campo',
    });
    const vars = variableCreationService.getVariablesByTaskInstanceId(projectId, taskId);
    expect(vars.length).toBeGreaterThan(0);
    const vid = vars[0]!.id;

    variableCreationService.renameVariableRowById(projectId, vid, 'dati_personali.colore');

    const renamed = restoreChildTaskBoundVariablesToLocalNames(projectId, taskId, new Set([vid]));
    expect(renamed.length).toBe(1);
    expect(renamed[0]!.previousName).toBe('dati_personali.colore');
    expect(renamed[0]!.nextName).toMatch(/colore/i);

    setProjectTranslationsRegistry({ [makeTranslationKey('var', vid)]: renamed[0]!.nextName });
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: {
          nodes: [],
          edges: [],
          meta: { translations: { [makeTranslationKey('var', vid)]: renamed[0]!.nextName } },
        },
      },
      'main'
    );
    const after = getVariableLabel(vid, getActiveFlowMetaTranslationsFlattened());
    expect(after).toBe(renamed[0]!.nextName);
    expect(after?.includes('.')).toBe(false);
  });

  it('skips restore when label already matches prefix.leaf from subflow title (idempotent vs autoRename)', () => {
    const projectId = `vitest_restore_qual_${Math.random().toString(36).slice(2, 14)}`;
    const taskId = 'task-restore-q1';
    const nodeId = 'f0000000-0000-4000-8000-0000000000f1';
    const roots: TaskTreeNode[] = [
      { id: nodeId, label: 'nome', subNodes: [], templateId: 't1' } as TaskTreeNode,
    ];
    const taskTree: TaskTree = {
      labelKey: 'Ask',
      nodes: roots,
      steps: {},
    };
    variableCreationService.hydrateVariablesFromTaskTree(projectId, 'main', taskId, taskTree);
    const vid = variableCreationService.getVariablesByTaskInstanceId(projectId, taskId)[0]!.id;
    /** Already-qualified parent label (same shape autoRename would produce). */
    setProjectTranslationsRegistry({
      [makeTranslationKey('var', vid)]: 'dati personali.nome',
    });

    const renamed = restoreChildTaskBoundVariablesToLocalNames(projectId, taskId, new Set([vid]), {
      subflowDisplayTitle: 'chiedi dati personali',
    });
    expect(renamed.length).toBe(0);
  });
});

describe('migrateSubflowVariableProxyModel', () => {
  it('renames child slot vars referenced in subflowBindings (interfaceParameterId)', () => {
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
    variableCreationService.hydrateVariablesFromTaskTree(projectId, childFlowId, childTaskId, childTaskTree);
    setProjectTranslationsRegistry({
      [makeTranslationKey('var', nodeIdB)]: 'colore',
    });
    const vars = variableCreationService.getVariablesByTaskInstanceId(projectId, childTaskId);
    const childVarId = vars[0]!.id;
    variableCreationService.renameVariableRowById(projectId, childVarId, 'dati_personali.colore');

    const parentVarId = 'c0000000-0000-4000-8000-0000000000c1';
    variableCreationService.ensureManualVariableWithId(projectId, parentVarId, 'parent.colore', {
      scope: 'flow',
      scopeFlowId: parentFlowId,
    });

    taskRepository.createTask(TaskType.Subflow, null, undefined, subflowTaskId, projectId);
    taskRepository.updateTask(subflowTaskId, {
      flowId: childFlowId,
      subflowBindingsSchemaVersion: 1,
      subflowBindings: [{ interfaceParameterId: childVarId, parentVariableId: parentVarId }],
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
                id: 'iface-row-1',
                wireKey: 'colore',
                variableRefId: childVarId,
                apiField: '',
              },
            ],
          },
        },
      },
    } as any;

    const r = migrateSubflowVariableProxyModel(projectId, flows);

    expect(r.childRenames.length).toBe(1);
    expect(r.childRenames[0]!.id).toBe(childVarId);
    setProjectTranslationsRegistry({ [makeTranslationKey('var', childVarId)]: 'colore' });
    FlowWorkspaceSnapshot.setSnapshot(
      {
        [childFlowId]: {
          id: childFlowId,
          meta: {
            translations: { [makeTranslationKey('var', childVarId)]: 'colore' },
          },
        },
      } as any,
      childFlowId
    );
    expect(getVariableLabel(childVarId, getActiveFlowMetaTranslationsFlattened())).toBe('colore');
    expect(r.syncCalls).toBe(0);
  });
});
