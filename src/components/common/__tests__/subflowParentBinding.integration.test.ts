/**
 * Integration tests: S2 subflowBindings resolution for parent-facing tokens.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { taskRepository } from '../../../services/TaskRepository';
import { variableCreationService } from '../../../services/VariableCreationService';
import { TaskType } from '../../../types/taskTypes';
import { ensureParentVariableAndSubflowOutputBinding } from '../subflowParentBinding';
import { getVariableLabel } from '../../../utils/getVariableLabel';
import {
  getProjectTranslationsTable,
  setProjectTranslationsRegistry,
} from '../../../utils/projectTranslationsRegistry';
import { makeTranslationKey } from '../../../utils/translationKeys';

function pid(): string {
  return `vitest_subflow_bind_${Math.random().toString(36).slice(2, 14)}`;
}

describe('ensureParentVariableAndSubflowOutputBinding (S2)', () => {
  beforeEach(() => {
    setProjectTranslationsRegistry({});
  });

  it('resolves parent var from subflowBindings', () => {
    const projectId = pid();
    const parentFlowId = 'flow_parent';
    const childFlowId = 'flow_child';
    const subflowTaskId = `task_sf_${Math.random().toString(36).slice(2, 10)}`;
    const childVarId = crypto.randomUUID();
    const parentVarId = crypto.randomUUID();

    taskRepository.createTask(
      TaskType.Subflow,
      null,
      {
        flowId: childFlowId,
        subflowBindingsSchemaVersion: 1,
        subflowBindings: [{ interfaceParameterId: childVarId, parentVariableId: parentVarId }],
      },
      subflowTaskId
    );

    variableCreationService.ensureManualVariableWithId(projectId, parentVarId, 'parent.token', {
      scope: 'flow',
      scopeFlowId: parentFlowId,
    });
    setProjectTranslationsRegistry({ [makeTranslationKey('variable', parentVarId)]: 'parent.token' });

    const flows = {
      [parentFlowId]: {
        nodes: [{ data: { rows: [{ id: subflowTaskId, text: 'chiedi email' }] } }],
      },
    };

    const out = ensureParentVariableAndSubflowOutputBinding(projectId, parentFlowId, flows, {
      isFromActiveFlow: false,
      ownerFlowId: childFlowId,
      id: childVarId,
      varLabel: 'conferma',
      sourceTaskRowLabel: 'chiedi email',
      subflowTaskId,
    });

    expect(out.parentVarId).toBe(parentVarId);
    expect(getVariableLabel(out.parentVarId, getProjectTranslationsTable())).toBe('parent.token');
  });

  it('throws when no subflowBindings row for child var', () => {
    const projectId = pid();
    const parentFlowId = 'flow_parent_2';
    const childFlowId = 'flow_child_2';
    const subflowTaskId = `task_sf_${Math.random().toString(36).slice(2, 10)}`;
    const childVarId = `var_child_${Math.random().toString(36).slice(2, 10)}`;

    taskRepository.createTask(TaskType.Subflow, null, {
      flowId: childFlowId,
      subflowBindingsSchemaVersion: 1,
      subflowBindings: [],
    }, subflowTaskId);

    const flows = {
      [parentFlowId]: {
        nodes: [{ data: { rows: [{ id: subflowTaskId, text: 'x' }] } }],
      },
    };

    expect(() =>
      ensureParentVariableAndSubflowOutputBinding(projectId, parentFlowId, flows, {
        isFromActiveFlow: false,
        ownerFlowId: childFlowId,
        id: childVarId,
        varLabel: 'y',
        subflowTaskId,
      })
    ).toThrow(/subflowBindings row/);
  });
});
