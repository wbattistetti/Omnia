/**
 * Integration tests: Subflow parent proxy binding, naming via variableProxyNaming, disambiguation.
 */
import { describe, expect, it } from 'vitest';
import { taskRepository } from '../../../services/TaskRepository';
import { variableCreationService } from '../../../services/VariableCreationService';
import { TaskType } from '../../../types/taskTypes';
import { ensureParentVariableAndSubflowOutputBinding } from '../subflowParentBinding';

function pid(): string {
  return `vitest_subflow_bind_${Math.random().toString(36).slice(2, 14)}`;
}

describe('ensureParentVariableAndSubflowOutputBinding (full round)', () => {
  it('creates flow-scoped parent var with semantic proxy name and output binding', () => {
    const projectId = pid();
    const parentFlowId = 'flow_parent';
    const childFlowId = 'flow_child';
    const subflowTaskId = `task_sf_${Math.random().toString(36).slice(2, 10)}`;
    const childVarId = `var_child_${Math.random().toString(36).slice(2, 10)}`;

    taskRepository.createTask(TaskType.Subflow, null, { flowId: childFlowId, outputBindings: [] }, subflowTaskId);

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

    expect(out.tokenLabel).toBe('email.conferma');
    expect(variableCreationService.getVarNameById(projectId, out.parentVarId)).toBe('email.conferma');

    const t = taskRepository.getTask(subflowTaskId) as any;
    expect(t?.outputBindings).toEqual([{ fromVariable: childVarId, toVariable: out.parentVarId }]);
  });

  it('disambiguates when the semantic proxy name is already taken in flow scope', () => {
    const projectId = pid();
    const parentFlowId = 'flow_parent_2';
    const childFlowId = 'flow_child_2';
    const subflowTaskId = `task_sf_${Math.random().toString(36).slice(2, 10)}`;
    const childVarId = `var_child_${Math.random().toString(36).slice(2, 10)}`;

    variableCreationService.createManualVariable(projectId, 'email.conferma', {
      scope: 'flow',
      scopeFlowId: parentFlowId,
    });

    taskRepository.createTask(TaskType.Subflow, null, { flowId: childFlowId, outputBindings: [] }, subflowTaskId);

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

    expect(out.tokenLabel).toBe('email.conferma_2');
    expect(variableCreationService.getVarNameById(projectId, out.parentVarId)).toBe('email.conferma_2');
  });

  it('returns existing parent token when output binding already maps child var', () => {
    const projectId = pid();
    const parentFlowId = 'flow_parent_3';
    const childFlowId = 'flow_child_3';
    const subflowTaskId = `task_sf_${Math.random().toString(36).slice(2, 10)}`;
    const childVarId = `var_child_${Math.random().toString(36).slice(2, 10)}`;

    const existing = variableCreationService.createManualVariable(projectId, 'already.bound', {
      scope: 'flow',
      scopeFlowId: parentFlowId,
    });

    taskRepository.createTask(TaskType.Subflow, null, {
      flowId: childFlowId,
      outputBindings: [{ fromVariable: childVarId, toVariable: existing.id }],
    }, subflowTaskId);

    const flows = { [parentFlowId]: { nodes: [] } };

    const out = ensureParentVariableAndSubflowOutputBinding(projectId, parentFlowId, flows, {
      isFromActiveFlow: false,
      ownerFlowId: childFlowId,
      id: childVarId,
      varLabel: 'ignored',
      subflowTaskId,
    });

    expect(out).toEqual({ tokenLabel: 'already.bound', parentVarId: existing.id });
  });

  it('resolves subflow task by normalized row label when subflowTaskId omitted', () => {
    const projectId = pid();
    const parentFlowId = 'flow_parent_4';
    const childFlowId = 'flow_child_4';
    const subflowTaskId = `task_sf_${Math.random().toString(36).slice(2, 10)}`;
    const childVarId = `var_child_${Math.random().toString(36).slice(2, 10)}`;

    taskRepository.createTask(TaskType.Subflow, null, { flowId: childFlowId, outputBindings: [] }, subflowTaskId);

    const flows = {
      [parentFlowId]: {
        nodes: [{ data: { rows: [{ id: subflowTaskId, text: 'richiedi telefono' }] } }],
      },
    };

    const out = ensureParentVariableAndSubflowOutputBinding(projectId, parentFlowId, flows, {
      isFromActiveFlow: false,
      ownerFlowId: childFlowId,
      id: childVarId,
      varLabel: 'ufficio',
      sourceTaskRowLabel: 'richiedi telefono',
    });

    expect(out.tokenLabel).toBe('telefono.ufficio');
    const t = taskRepository.getTask(subflowTaskId) as any;
    expect(t?.outputBindings?.[0]?.fromVariable).toBe(childVarId);
  });
});
