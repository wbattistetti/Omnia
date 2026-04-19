/**
 * Deterministic, single-transaction application of a {@link WorkspaceMachineEvent} to {@link WorkspaceState}.
 * Structural events run the same domain pipeline as the live orchestrator, but commit `flowsNext` in one shot.
 */

import { runStructuralCommandSync } from '@domain/structural/StructuralOrchestrator';
import type { ApplyTaskMoveToSubflowResult } from '@domain/taskSubflowMove/applyTaskMoveToSubflow';
import type { Flow, WorkspaceState } from '@flows/FlowTypes';
import {
  reduceApplyFlowLoadResult,
  reduceCloseFlow,
  reduceMarkFlowsPersisted,
  reduceMarkFlowsVariablesReady,
  reduceOpenFlow,
  reduceOpenFlowBackground,
  reduceRenameFlow,
  reduceSetActiveFlow,
  reduceUpdateFlowGraph,
  reduceUpdateFlowMeta,
  reduceUpsertFlow,
} from '@flows/workspaceTransitions';
import { createTxnStructuralOrchestratorContext } from './txnStructuralOrchestratorContext';
import type { WorkspaceMachineEvent } from './WorkspaceMachineEvents';

function hasWorkspaceFlowsNext(
  r: unknown
): r is { flowsNext: WorkspaceState['flows'] } {
  if (r == null || typeof r !== 'object') return false;
  const f = (r as { flowsNext?: unknown }).flowsNext;
  return f != null && typeof f === 'object' && !Array.isArray(f);
}

function applyStructuralToSnapshot<NodeT, EdgeT>(
  state: WorkspaceState<NodeT, EdgeT>,
  event: Extract<WorkspaceMachineEvent<NodeT, EdgeT>, { type: 'structuralCommand' }>
):
  | { state: WorkspaceState<NodeT, EdgeT>; domain: ApplyTaskMoveToSubflowResult | null }
  | { state: WorkspaceState<NodeT, EdgeT>; domain: null } {
  const pid = String(event.projectId || '').trim();
  if (!pid) {
    throw new Error('[applyWorkspaceMachineEvent] structuralCommand requires a non-empty projectId');
  }
  const ctx = createTxnStructuralOrchestratorContext(state.flows, pid, event.projectData);
  const result = runStructuralCommandSync(ctx, event.command);
  if (!hasWorkspaceFlowsNext(result)) {
    return { state, domain: null };
  }
  return {
    state: { ...state, flows: result.flowsNext as Record<string, Flow<NodeT, EdgeT>> },
    domain: result as ApplyTaskMoveToSubflowResult,
  };
}

export type ApplyWorkspaceMachineEventOutcome<NodeT = any, EdgeT = any> = {
  workspace: WorkspaceState<NodeT, EdgeT>;
  /** Present when a structural pipeline returned a typed subflow apply envelope. */
  structural?: ApplyTaskMoveToSubflowResult | null;
};

/**
 * Applies one workspace machine event and returns the next workspace snapshot (pure reducer step).
 */
export function applyWorkspaceMachineEvent<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  event: WorkspaceMachineEvent<NodeT, EdgeT>
): ApplyWorkspaceMachineEventOutcome<NodeT, EdgeT> {
  switch (event.type) {
    case 'upsertFlow':
      return {
        workspace: reduceUpsertFlow(state, event.flow, event.upsertOpts),
      };
    case 'upsertFlows': {
      let w = state;
      for (const f of event.flows) {
        w = reduceUpsertFlow(w, f, event.upsertOpts);
      }
      return { workspace: w };
    }
    case 'updateFlowGraph':
      return { workspace: reduceUpdateFlowGraph(state, event.flowId, event.updater) };
    case 'updateFlowMeta':
      return { workspace: reduceUpdateFlowMeta(state, event.flowId, event.patch) };
    case 'applyFlowLoadResult':
      return { workspace: reduceApplyFlowLoadResult(state, event.flowId, event.payload) };
    case 'markFlowsVariablesReady':
      return { workspace: reduceMarkFlowsVariablesReady(state, event.flowIds) };
    case 'markFlowsPersisted':
      return { workspace: reduceMarkFlowsPersisted(state, event.flowIds) };
    case 'openFlow':
      return { workspace: reduceOpenFlow(state, event.flowId) };
    case 'openFlowBackground':
      return { workspace: reduceOpenFlowBackground(state, event.flowId) };
    case 'closeFlow':
      return { workspace: reduceCloseFlow(state, event.flowId) };
    case 'setActiveFlow':
      return { workspace: reduceSetActiveFlow(state, event.flowId) };
    case 'renameFlow':
      return { workspace: reduceRenameFlow(state, event.flowId, event.title) };
    case 'structuralCommand': {
      const out = applyStructuralToSnapshot(state, event);
      return { workspace: out.state, structural: out.domain ?? undefined };
    }
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
