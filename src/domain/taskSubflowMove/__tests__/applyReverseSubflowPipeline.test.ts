/**
 * Reverse subflow pipeline: subflow_* → parent canvas merge using portal `subflowBindings`.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { TaskType } from '@types/taskTypes';
import type { WorkspaceState } from '@flows/FlowTypes';
import type { VariableInstance } from '@types/variableTypes';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import {
  applyReverseSubflowPipeline,
  isReverseSubflowMove,
} from '../applyReverseSubflowPipeline';
import { makeTranslationKey } from '@utils/translationKeys';

const VID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PORTAL_ROW = 'portal-task-row-11111111-1111-4111-8111-111111111111';
const MOVED_TASK = 'moved-task-22222222-2222-4222-8222-222222222222';
const CHILD_FLOW = `subflow_${PORTAL_ROW}`;
const PARENT_FLOW = 'main';

function minimalFlowSlice(id: string): WorkspaceState['flows'][string] {
  return {
    id,
    title: id,
    nodes: [],
    edges: [],
    meta: {
      flowInterface: { input: [], output: [] },
      translations: {},
    },
  } as WorkspaceState['flows'][string];
}

describe('applyReverseSubflowPipeline', () => {
  beforeEach(() => {
    (taskRepository as unknown as { tasks: Map<string, unknown> }).tasks.clear();
  });

  it('isReverseSubflowMove is true only for subflow_* → non-subflow', () => {
    expect(isReverseSubflowMove(CHILD_FLOW, PARENT_FLOW)).toBe(true);
    expect(isReverseSubflowMove(PARENT_FLOW, CHILD_FLOW)).toBe(false);
    expect(isReverseSubflowMove(PARENT_FLOW, PARENT_FLOW)).toBe(false);
  });

  it('replaces parent proxy A with child id B in parent flow slice and drops proxy row', () => {
    const projectId = `pr_${Math.random().toString(36).slice(2, 9)}`;

    taskRepository.createTask(TaskType.Subflow, null, { label: 'Sub' }, PORTAL_ROW, projectId);
    const portal = taskRepository.getTask(PORTAL_ROW)!;
    taskRepository.overwriteTaskDocument(PORTAL_ROW, {
      ...portal,
      subflowBindingsSchemaVersion: 1,
      subflowBindings: [{ interfaceParameterId: VID_B, parentVariableId: VID_A }],
    });

    taskRepository.createTask(TaskType.SayMessage, null, { label: 'Hi' }, MOVED_TASK, projectId);

    const varA: VariableInstance = {
      id: VID_A,
      taskInstanceId: MOVED_TASK,
      dataPath: '',
      scope: 'flow',
      scopeFlowId: PARENT_FLOW,
    };
    const varB: VariableInstance = {
      id: VID_B,
      taskInstanceId: MOVED_TASK,
      dataPath: '',
      scope: 'flow',
      scopeFlowId: CHILD_FLOW,
    };
    const svc = variableCreationService as unknown as {
      projectKey: (p: string) => string;
      store: Map<string, VariableInstance[]>;
    };
    svc.store.set(svc.projectKey(projectId), [varA, varB]);

    const flows: WorkspaceState['flows'] = {
      [PARENT_FLOW]: {
        ...minimalFlowSlice(PARENT_FLOW),
        meta: {
          ...(minimalFlowSlice(PARENT_FLOW).meta || {}),
          translations: {
            [makeTranslationKey('var', VID_A)]: 'proxy A',
            [makeTranslationKey('var', VID_B)]: 'child B',
          },
          scanMarker: `ref:${VID_A}`,
        },
      },
      [CHILD_FLOW]: {
        ...minimalFlowSlice(CHILD_FLOW),
        meta: {
          ...(minimalFlowSlice(CHILD_FLOW).meta || {}),
          flowInterface: {
            input: [],
            output: [{ variableRefId: VID_B, wireKey: 'x', labelKey: makeTranslationKey('var', VID_B) }],
          },
          translations: {
            [makeTranslationKey('var', VID_B)]: 'child B',
          },
        },
      },
    };

    const result = applyReverseSubflowPipeline({
      projectId,
      flows,
      fromFlowId: CHILD_FLOW,
      toFlowId: PARENT_FLOW,
      movedTaskId: MOVED_TASK,
    });

    const parentMeta = result.flowsNext[PARENT_FLOW]?.meta as {
      translations?: Record<string, string>;
      scanMarker?: string;
    };
    expect(parentMeta?.scanMarker).toBe(`ref:${VID_B}`);
    expect(parentMeta?.translations?.[makeTranslationKey('var', VID_A)]).toBeUndefined();
    expect(parentMeta?.translations?.[makeTranslationKey('var', VID_B)]).toBe('child B');

    const store = variableCreationService.getAllVariables(projectId) ?? [];
    expect(store.some((v) => v.id === VID_A)).toBe(false);
    const rowB = store.find((v) => v.id === VID_B);
    expect(rowB?.scopeFlowId).toBe(PARENT_FLOW);

    expect(result.clearedPortalBindings).toBe(true);
    const portalAfter = taskRepository.getTask(PORTAL_ROW);
    expect(portalAfter?.subflowBindings).toBeUndefined();
  });

  it('with no binding rows only updates authoring canvas id on moved task', () => {
    const projectId = `pr_${Math.random().toString(36).slice(2, 9)}`;

    taskRepository.createTask(TaskType.Subflow, null, { label: 'Sub' }, PORTAL_ROW, projectId);
    taskRepository.createTask(TaskType.SayMessage, null, { label: 'Hi' }, MOVED_TASK, projectId);

    const flows: WorkspaceState['flows'] = {
      [PARENT_FLOW]: minimalFlowSlice(PARENT_FLOW),
      [CHILD_FLOW]: minimalFlowSlice(CHILD_FLOW),
    };

    const result = applyReverseSubflowPipeline({
      projectId,
      flows,
      fromFlowId: CHILD_FLOW,
      toFlowId: PARENT_FLOW,
      movedTaskId: MOVED_TASK,
    });

    expect(result.pairs.length).toBe(0);
    expect(taskRepository.getTask(MOVED_TASK)?.authoringFlowCanvasId).toBe(PARENT_FLOW);
    expect(result.flowsNext).toBe(flows);
  });
});
