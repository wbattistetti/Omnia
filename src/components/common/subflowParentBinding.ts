/**
 * Policy S2: parent-facing tokens use `subflowBindings` on the Subflow task (interfaceParameterId → parentVariableId).
 * No proxy variables and no legacy outputBindings.
 */

import { normalizeSemanticTaskLabel } from '../../domain/variableProxyNaming';
import { taskRepository } from '../../services/TaskRepository';
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

function resolveSubflowFlowId(task: { flowId?: string; parameters?: Array<{ parameterId?: string; value?: string }> }): string {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p) => String(p?.parameterId || '').trim() === 'flowId');
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
    throw new Error(`Active flow '${activeFlowId}' not found while resolving Subflow task.`);
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
 * Resolves the parent variable id and label for a child-flow variable using S2 `subflowBindings` on the Subflow task.
 */
export function ensureParentVariableAndSubflowOutputBinding(
  projectId: string,
  activeFlowId: string,
  flows: WorkspaceFlows,
  item: VariableMenuLikeItem
): { tokenLabel: string; parentVarId: string } {
  void projectId;
  void activeFlowId;

  if (item.isFromActiveFlow !== false) {
    throw new Error('Expected a child-flow variable item, but received an active-flow item.');
  }

  const childFlowId = String(item.ownerFlowId || '').trim();
  const childVarId = String(item.id || '').trim();
  if (!childFlowId || !childVarId) {
    throw new Error('Cannot resolve binding: child flow id or child variable id is missing.');
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
    throw new Error(`Subflow task '${subflowTaskId}' not found.`);
  }

  const bindings = Array.isArray((subflowTask as { subflowBindings?: unknown }).subflowBindings)
    ? (subflowTask as { subflowBindings: Array<{ interfaceParameterId?: string; parentVariableId?: string }> })
        .subflowBindings
    : [];

  const row = bindings.find((b) => String(b?.interfaceParameterId || '').trim() === childVarId);
  const parentId = row ? String(row.parentVariableId || '').trim() : '';
  if (!parentId) {
    throw new Error(
      `Subflow task '${subflowTaskId}' has no S2 subflowBindings row for interfaceParameterId='${childVarId}'. ` +
        `Add { interfaceParameterId: child variableRefId, parentVariableId: parent variable GUID }.`
    );
  }

  const name = getVariableLabel(parentId, getProjectTranslationsTable());
  if (!name) {
    throw new Error(
      `Subflow binding references parent variable '${parentId}' but it has no label in translations.`
    );
  }
  return { tokenLabel: name, parentVarId: parentId };
}
