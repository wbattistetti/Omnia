import {
  buildSubflowParentProxyVariableName,
  disambiguateProxyVarName,
  normalizeSemanticTaskLabel,
} from '../../domain/variableProxyNaming';
import { taskRepository } from '../../services/TaskRepository';
import { variableCreationService } from '../../services/VariableCreationService';
import { getVariableLabel } from '../../utils/getVariableLabel';
import { getProjectTranslationsTable } from '../../utils/projectTranslationsRegistry';
import { TaskType } from '../../types/taskTypes';

type VariableMenuLikeItem = {
  id: string;
  varLabel: string;
  ownerFlowId?: string;
  isFromActiveFlow?: boolean;
  sourceTaskRowLabel?: string;
  subflowTaskId?: string;
};

type WorkspaceFlows = Record<string, { nodes?: Array<{ data?: { rows?: Array<{ id?: string; text?: string }> } }> }>;

type SubflowIoBinding = {
  fromVariable: string;
  toVariable: string;
};

function resolveSubflowFlowId(task: any): string {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p: any) => String(p?.parameterId || '').trim() === 'flowId');
  return String(fromParam?.value || '').trim();
}

function findBestSubflowTaskId(
  activeFlowId: string,
  childFlowId: string,
  sourceTaskRowLabel: string,
  flows: WorkspaceFlows
): string {
  const flow = flows[activeFlowId];
  if (!flow) {
    throw new Error(`Active flow '${activeFlowId}' not found while binding subflow variable.`);
  }

  const candidates: Array<{ taskId: string; rowText: string }> = [];
  for (const node of flow.nodes || []) {
    for (const row of node?.data?.rows || []) {
      const taskId = String(row?.id || '').trim();
      if (!taskId) continue;
      const task = taskRepository.getTask(taskId);
      if (!task || task.type !== TaskType.Subflow) continue;
      const fid = resolveSubflowFlowId(task);
      if (!fid || fid !== childFlowId) continue;
      candidates.push({ taskId, rowText: normalizeSemanticTaskLabel(String(row?.text || '')) });
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      `No Subflow task in parent flow '${activeFlowId}' references child flow '${childFlowId}'.`
    );
  }

  const wanted = normalizeSemanticTaskLabel(sourceTaskRowLabel || '');
  if (wanted) {
    const exact = candidates.find((c) => c.rowText === wanted);
    if (exact) return exact.taskId;
  }
  return candidates[0].taskId;
}

/**
 * Creates/gets a parent-local variable for a selected child-interface variable and
 * ensures an output binding exists on the parent Subflow task.
 */
export function ensureParentVariableAndSubflowOutputBinding(
  projectId: string,
  activeFlowId: string,
  flows: WorkspaceFlows,
  item: VariableMenuLikeItem
): { tokenLabel: string; parentVarId: string } {
  if (item.isFromActiveFlow !== false) {
    throw new Error('Expected a child-flow variable item, but received an active-flow item.');
  }

  const childFlowId = String(item.ownerFlowId || '').trim();
  const childVarId = String(item.id || '').trim();
  if (!childFlowId || !childVarId) {
    throw new Error('Cannot create parent binding: child flow id or child variable id is missing.');
  }
  if (childVarId.startsWith('iface:')) {
    throw new Error(
      'Interface output is not wired to a child variable yet. Wire it in the child flow interface, then bind again.'
    );
  }

  const subflowTaskId = String(item.subflowTaskId || '').trim()
    ? String(item.subflowTaskId).trim()
    : findBestSubflowTaskId(activeFlowId, childFlowId, item.sourceTaskRowLabel || '', flows);

  const subflowTask = taskRepository.getTask(subflowTaskId);
  if (!subflowTask) {
    throw new Error(`Subflow task '${subflowTaskId}' not found while updating output bindings.`);
  }

  const prevBindings = Array.isArray((subflowTask as any).outputBindings)
    ? ((subflowTask as any).outputBindings as SubflowIoBinding[])
    : [];

  const existingForChild = prevBindings.find((b) => String(b?.fromVariable || '') === childVarId);
  if (existingForChild) {
    const toId = String(existingForChild.toVariable || '').trim();
    const name = getVariableLabel(toId, getProjectTranslationsTable());
    if (!name) {
      throw new Error(
        `Subflow output binding references missing parent variable '${toId}'. Fix outputBindings on this Subflow task.`
      );
    }
    return { tokenLabel: name, parentVarId: toId };
  }

  const baseLabel = buildSubflowParentProxyVariableName(item.sourceTaskRowLabel || 'Subflow', item.varLabel);
  const tokenLabel = disambiguateProxyVarName(baseLabel, (name) =>
    !!variableCreationService.findVariableInFlowScopeByExactName(projectId, activeFlowId, name)
  );

  const parentVar = variableCreationService.createManualVariable(projectId, tokenLabel, {
    scope: 'flow',
    scopeFlowId: activeFlowId,
  });

  const alreadyBound = prevBindings.some(
    (b) => String(b?.fromVariable || '') === childVarId && String(b?.toVariable || '') === parentVar.id
  );
  if (!alreadyBound) {
    const nextBindings: SubflowIoBinding[] = [
      ...prevBindings,
      { fromVariable: childVarId, toVariable: parentVar.id },
    ];
    const updated = taskRepository.updateTask(subflowTaskId, { outputBindings: nextBindings } as any);
    if (!updated) {
      throw new Error(`Failed to update Subflow task '${subflowTaskId}' output bindings.`);
    }
  }

  return { tokenLabel, parentVarId: parentVar.id };
}
