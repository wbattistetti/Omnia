/**
 * Shared second-pass wiring (merge OUTPUT + bindings) after variables exist — used by the orchestrator
 * and by {@link tryFlushSubflowSecondPassForTask} without importing the full orchestrator (avoids cycles).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { applyTaskMoveToSubflow, type ApplyTaskMoveToSubflowResult } from '@domain/taskSubflowMove/applyTaskMoveToSubflow';
import type { ProjectConditionLike } from '@domain/taskSubflowMove/collectReferencedVarIds';
import { variableCreationService } from '@services/VariableCreationService';
import { reconcileUtteranceVariableStoreWithFlowGraph } from './reconcileVariableStore';
import { logStructuralOrchestratorCommitSnapshot } from '@utils/flowStructuralCommitDiagnostic';

function emitVariableStoreUpdated(): void {
  try {
    document.dispatchEvent(new CustomEvent('variableStore:updated', { bubbles: true }));
  } catch {
    /* noop */
  }
}

export type SubflowWiringSecondPassCoreParams = {
  projectId: string;
  parentFlowId: string;
  childFlowId: string;
  taskInstanceId: string;
  subflowDisplayTitle: string;
  parentSubflowTaskRowId: string;
  conditions?: ProjectConditionLike[];
  translations?: Record<string, string>;
  projectData?: unknown;
  exposeAllTaskVariablesInChildInterface?: boolean;
};

export function executeSubflowWiringSecondPassCore(
  flows: WorkspaceState['flows'],
  commitFlowSlices: (flowsNext: WorkspaceState['flows'], flowIds: string[]) => boolean,
  params: SubflowWiringSecondPassCoreParams
): ApplyTaskMoveToSubflowResult | null {
  const pid = String(params.projectId || '').trim();
  const tid = String(params.taskInstanceId || '').trim();
  if (!pid || !tid) return null;
  if (!flows[params.parentFlowId] || !flows[params.childFlowId]) return null;

  const vars = variableCreationService.getVariablesByTaskInstanceId(pid, tid);
  if (vars.length === 0) return null;

  reconcileUtteranceVariableStoreWithFlowGraph(pid, flows, { skipGlobalMerge: true });
  emitVariableStoreUpdated();

  const translationsArg =
    params.translations && Object.keys(params.translations).length > 0 ? params.translations : undefined;

  const result = applyTaskMoveToSubflow({
    projectId: pid,
    parentFlowId: params.parentFlowId,
    childFlowId: params.childFlowId,
    taskInstanceId: tid,
    subflowDisplayTitle: params.subflowDisplayTitle,
    parentSubflowTaskRowId: params.parentSubflowTaskRowId,
    flows,
    conditions: params.conditions,
    translations: translationsArg,
    projectData: params.projectData,
    skipStructuralPhase: true,
    skipMaterialization: true,
    isLinkedSubflowMove: true,
    secondPass: true,
    exposeAllTaskVariablesInChildInterface: params.exposeAllTaskVariablesInChildInterface,
  });

  logStructuralOrchestratorCommitSnapshot('subflowWiringSecondPassCore', result.flowsNext, [
    params.parentFlowId,
    params.childFlowId,
  ]);
  const committed = commitFlowSlices(result.flowsNext, [params.parentFlowId, params.childFlowId]);
  return { ...result, flowStoreCommitOk: committed };
}
