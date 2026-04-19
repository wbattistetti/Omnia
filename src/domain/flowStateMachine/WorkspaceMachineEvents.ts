/**
 * Unified event vocabulary for {@link applyWorkspaceMachineEvent}.
 * Structural domain work uses the existing {@link StructuralCommand} shape for compatibility.
 */

import type { StructuralCommand } from '@domain/structural/commands';
import type { Flow, FlowId, WorkspaceState } from '@flows/FlowTypes';
import type { ApplyFlowLoadPayload } from '@flows/ApplyFlowLoadPayload';
import type { UpsertFlowTransitionOptions } from '@flows/workspaceTransitions';

export type WorkspaceMachineEvent<NodeT = any, EdgeT = any> =
  | { type: 'upsertFlow'; flow: Flow<NodeT, EdgeT>; upsertOpts?: UpsertFlowTransitionOptions }
  /** Atomic application of multiple flow slices in one reducer step (e.g. portal parent+child). */
  | { type: 'upsertFlows'; flows: Flow<NodeT, EdgeT>[]; upsertOpts?: UpsertFlowTransitionOptions }
  | {
      type: 'updateFlowGraph';
      flowId: FlowId;
      updater: (nodes: NodeT[], edges: EdgeT[]) => { nodes: NodeT[]; edges: EdgeT[] };
    }
  | { type: 'updateFlowMeta'; flowId: FlowId; patch: Record<string, unknown> }
  | { type: 'applyFlowLoadResult'; flowId: FlowId; payload: ApplyFlowLoadPayload<NodeT, EdgeT> }
  | { type: 'markFlowsVariablesReady'; flowIds: FlowId[] }
  | { type: 'markFlowsPersisted'; flowIds: FlowId[] }
  | { type: 'openFlow'; flowId: FlowId }
  | { type: 'openFlowBackground'; flowId: FlowId }
  | { type: 'closeFlow'; flowId: FlowId }
  | { type: 'setActiveFlow'; flowId: FlowId }
  | { type: 'renameFlow'; flowId: FlowId; title: string }
  | { type: 'structuralCommand'; projectId: string; projectData?: unknown; command: StructuralCommand };

export type WorkspaceMachineSnapshot<NodeT = any, EdgeT = any> = WorkspaceState<NodeT, EdgeT>;
