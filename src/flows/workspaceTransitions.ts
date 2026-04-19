/**
 * Pure workspace state transitions for the flow canvas store.
 * Single implementation shared by the reducer and {@link FlowStateMachine} so snapshots stay deterministic.
 */

import { mergeFlowMetaOnServerLoad, shouldKeepLocalGraphOnEmptyServerResponse } from './flowLoadMergePolicy';
import { logFlowSaveDebug } from '../utils/flowSaveDebug';
import { logFlowHydrationTrace } from '../utils/flowHydrationTrace';
import { logTaskSubflowMove } from '../utils/taskSubflowMoveDebug';
import { isSubflowCanvasDebugEnabled, logSubflowCanvasDebug, summarizeFlowSlice } from '../utils/subflowCanvasDebug';
import type { Flow, FlowId, WorkspaceState } from './FlowTypes';
import type { ApplyFlowLoadPayload } from './ApplyFlowLoadPayload';
import { stripLegacyVariablesFromFlowMeta } from './flowMetaSanitize';
import { mergeUpsertNodesPreserveLocalRowText } from './mergeUpsertFlowNodesPreserveLocalRowText';
import { getActiveDndOperationId, isDndOperationInstrumentEnabled } from '@utils/dndOperationInstrument';
import { isStrictStoreUpsertMergeEnabled } from '@domain/flowStateMachine/flowMachineConfig';

export type UpsertFlowTransitionOptions = {
  /**
   * When false, inbound upserts replace `data.rows` text from the server slice as-is (no merge with previous local row text).
   * Use when the store is the sole writer of row labels.
   */
  preserveLocalRowTextOnUpsert?: boolean;
};

function coalescePreserveLocalRowText(opts: UpsertFlowTransitionOptions | undefined): boolean {
  if (opts?.preserveLocalRowTextOnUpsert !== undefined) {
    return opts.preserveLocalRowTextOnUpsert;
  }
  return !isStrictStoreUpsertMergeEnabled();
}

export function reduceUpsertFlow<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  inc: Flow<NodeT, EdgeT>,
  opts?: UpsertFlowTransitionOptions
): WorkspaceState<NodeT, EdgeT> {
  const prev = state.flows[inc.id];
  const fid = String(inc.id || '');
  let incMerged = inc;

  if (
    fid.startsWith('subflow_') &&
    prev &&
    Array.isArray(inc.nodes) &&
    inc.nodes.length === 0 &&
    Array.isArray(prev.nodes) &&
    prev.nodes.length > 0
  ) {
    incMerged = {
      ...inc,
      nodes: prev.nodes as any,
      edges:
        Array.isArray(inc.edges) &&
        inc.edges.length === 0 &&
        Array.isArray(prev.edges) &&
        prev.edges.length > 0
          ? (prev.edges as any)
          : inc.edges !== undefined
            ? inc.edges
            : prev.edges,
    } as Flow<NodeT, EdgeT>;
    logSubflowCanvasDebug('FlowStore:UPSERT_FLOW preserved graph (rejected empty nodes over stale subflow upsert)', {
      flowId: fid,
      preservedNodeCount: prev.nodes.length,
      preservedEdgeCount: Array.isArray(prev.edges) ? prev.edges.length : 0,
    });
    logTaskSubflowMove('FlowStore:UPSERT_FLOW:preservedEmptyIncomingSubflow', {
      flowId: fid,
      prevNodeCount: prev.nodes?.length ?? 0,
      incNodeCount: Array.isArray(inc.nodes) ? inc.nodes.length : -1,
    });
  }

  if (coalescePreserveLocalRowText(opts) && prev && Array.isArray(incMerged.nodes)) {
    const withLocalRows = mergeUpsertNodesPreserveLocalRowText(prev, incMerged.nodes as unknown[]);
    if (withLocalRows !== undefined) {
      incMerged = { ...incMerged, nodes: withLocalRows as any } as typeof incMerged;
    }
  }

  const nonEmpty = (incMerged.nodes?.length ?? 0) > 0 || (incMerged.edges?.length ?? 0) > 0;
  const mergedForUpsert = { ...incMerged } as Flow<NodeT, EdgeT>;
  if (mergedForUpsert.meta !== undefined) {
    const metaAfterMerge =
      prev !== undefined
        ? mergeFlowMetaOnServerLoad({
            flowId: inc.id,
            localMeta: prev.meta,
            serverMeta: mergedForUpsert.meta,
            hasLocalChanges: prev.hasLocalChanges === true ? true : mergedForUpsert.hasLocalChanges,
          })
        : mergedForUpsert.meta;
    mergedForUpsert.meta = stripLegacyVariablesFromFlowMeta(metaAfterMerge);
  }
  const flow = {
    ...mergedForUpsert,
    /**
     * Preserve existing meta when the incoming upsert omits it entirely (e.g. Dock layout-only
     * upserts that carry `{id, title, nodes, edges}` but no `meta`). Without this, every Dock
     * sync would silently drop `meta.translations` and related flow-document fields.
     */
    meta: mergedForUpsert.meta !== undefined ? mergedForUpsert.meta : prev?.meta,
    tasks: mergedForUpsert.tasks ?? prev?.tasks,
    variables: mergedForUpsert.variables ?? prev?.variables,
    bindings: mergedForUpsert.bindings ?? prev?.bindings,
    hydrated: mergedForUpsert.hydrated !== undefined ? mergedForUpsert.hydrated : (prev?.hydrated ?? false),
    variablesReady:
      mergedForUpsert.variablesReady !== undefined ? mergedForUpsert.variablesReady : (prev?.variablesReady ?? false),
    hasLocalChanges:
      mergedForUpsert.hasLocalChanges !== undefined
        ? mergedForUpsert.hasLocalChanges
        : prev !== undefined
          ? (prev.hasLocalChanges ?? false)
          : nonEmpty,
    serverHydrationApplied:
      mergedForUpsert.serverHydrationApplied !== undefined
        ? mergedForUpsert.serverHydrationApplied
        : (prev?.serverHydrationApplied ?? false),
  } as Flow<NodeT, EdgeT>;

  const preservedEmptyIncomingSubflow =
    fid.startsWith('subflow_') &&
    !!prev &&
    Array.isArray(inc.nodes) &&
    inc.nodes.length === 0 &&
    Array.isArray(prev.nodes) &&
    prev.nodes.length > 0;

  if (isDndOperationInstrumentEnabled()) {
    const operationId = getActiveDndOperationId();
    const nodeCountBefore = Array.isArray(prev?.nodes) ? prev!.nodes!.length : 0;
    const nodeCountAfter = Array.isArray(flow.nodes) ? flow.nodes.length : 0;
    console.log('[FlowStore:upsert]', {
      operationId: operationId ?? undefined,
      flowId: fid,
      nodeCountBefore,
      nodeCountAfter,
      preservedEmptyIncomingSubflow,
    });
  }

  if (isSubflowCanvasDebugEnabled() && fid.startsWith('subflow_')) {
    logSubflowCanvasDebug('FlowStore:UPSERT_FLOW', {
      flowId: inc.id,
      incomingHydrated: inc.hydrated,
      incomingHasLocalChanges: inc.hasLocalChanges,
      merged: summarizeFlowSlice(flow as any, { rowIdsSample: true }),
    });
  }
  const flows = { ...state.flows, [inc.id]: flow };
  return { ...state, flows };
}

export function reduceUpdateFlowGraph<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowId: FlowId,
  updater: (nodes: NodeT[], edges: EdgeT[]) => { nodes: NodeT[]; edges: EdgeT[] }
): WorkspaceState<NodeT, EdgeT> {
  const curr = state.flows[flowId];
  if (!curr) return state;
  const next = updater(curr.nodes as any[], curr.edges as any[]);
  const flow = {
    ...curr,
    nodes: next.nodes as any,
    edges: next.edges as any,
    hasLocalChanges: true,
  } as Flow<NodeT, EdgeT>;
  return { ...state, flows: { ...state.flows, [flowId]: flow } };
}

export function reduceUpdateFlowMeta<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowId: FlowId,
  patch: Record<string, unknown>
): WorkspaceState<NodeT, EdgeT> {
  const curr = state.flows[flowId];
  if (!curr) return state;
  const prevMeta = (curr.meta && typeof curr.meta === 'object' ? curr.meta : {}) as Record<string, unknown>;
  const patchClean = { ...patch } as Record<string, unknown>;
  delete patchClean.variables;
  const flow = {
    ...curr,
    meta: stripLegacyVariablesFromFlowMeta({ ...prevMeta, ...patchClean }) as Flow<NodeT, EdgeT>['meta'],
    hasLocalChanges: true,
  } as Flow<NodeT, EdgeT>;
  return { ...state, flows: { ...state.flows, [flowId]: flow } };
}

export function reduceApplyFlowLoadResult<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowId: FlowId,
  payload: ApplyFlowLoadPayload<NodeT, EdgeT>
): WorkspaceState<NodeT, EdgeT> {
  const curr = state.flows[flowId];
  if (!curr) {
    logFlowSaveDebug('FlowStore: FIX-MAIN-EMPTY APPLY_FLOW_LOAD_RESULT noop (missing slice)', {
      flowId,
    });
    if (isSubflowCanvasDebugEnabled()) {
      logSubflowCanvasDebug('FlowStore:APPLY_FLOW_LOAD_RESULT noop (missing slice)', {
        flowId,
      });
    }
    return state;
  }
  const localNodeCountBefore = curr.nodes?.length ?? 0;
  const localEdgeCountBefore = curr.edges?.length ?? 0;
  const localGraphNonEmpty = localNodeCountBefore > 0 || localEdgeCountBefore > 0;
  if (curr.hydrated === true && localGraphNonEmpty) {
    logFlowHydrationTrace('FlowStore APPLY_FLOW_LOAD_RESULT noop (hydrated + local graph non-empty)', {
      flowId,
      localNodeCountBefore,
      localEdgeCountBefore,
    });
    logFlowSaveDebug('FlowStore: FIX-MAIN-EMPTY APPLY_FLOW_LOAD_RESULT noop (hydrated + non-empty local graph)', {
      flowId,
      localNodeCountBefore,
      localEdgeCountBefore,
    });
    if (isSubflowCanvasDebugEnabled()) {
      logSubflowCanvasDebug('FlowStore:APPLY_FLOW_LOAD_RESULT noop (hydrated_with_graph)', {
        flowId,
        ...summarizeFlowSlice(curr as any, { rowIdsSample: true }),
      });
    }
    return state;
  }
  if (curr.hydrated === true && !localGraphNonEmpty) {
    logFlowHydrationTrace('FlowStore: applying server payload (hydrated but local graph empty)', {
      flowId,
      hydrated: curr.hydrated,
      serverHydrationAppliedBefore: curr.serverHydrationApplied ?? false,
    });
    logFlowSaveDebug('FlowStore: FIX-MAIN-EMPTY APPLY_FLOW_LOAD_RESULT apply server while local graph empty', {
      flowId,
      hydrated: curr.hydrated,
      serverHydrationAppliedBefore: curr.serverHydrationApplied ?? false,
    });
  }
  const serverNodes = (payload.nodes as any[]) ?? [];
  const serverEdges = (payload.edges as any[]) ?? [];
  const localNodeCount = curr.nodes?.length ?? 0;
  const keepLocalGraph = shouldKeepLocalGraphOnEmptyServerResponse({
    serverNodeCount: serverNodes.length,
    localNodeCount,
    hasLocalChanges: curr.hasLocalChanges,
    flowId,
  });
  const nextNodes = keepLocalGraph ? (curr.nodes as any[]) : serverNodes;
  const nextEdges = keepLocalGraph ? (curr.edges as any[]) : serverEdges;
  const mergedMeta = stripLegacyVariablesFromFlowMeta(
    mergeFlowMetaOnServerLoad({
      flowId,
      localMeta: curr.meta,
      serverMeta: payload.meta,
      hasLocalChanges: curr.hasLocalChanges,
    })
  );
  const flow = {
    ...curr,
    nodes: nextNodes as any,
    edges: nextEdges as any,
    meta: mergedMeta,
    ...(Array.isArray(payload.tasks) ? { tasks: payload.tasks } : {}),
    ...(Array.isArray(payload.variables) ? { variables: payload.variables } : {}),
    ...(Array.isArray(payload.bindings) ? { bindings: payload.bindings } : {}),
    hydrated: true,
    variablesReady: false,
    hasLocalChanges: keepLocalGraph ? true : false,
    serverHydrationApplied: true,
  } as Flow<NodeT, EdgeT>;
  if (keepLocalGraph) {
    logFlowSaveDebug('FlowStore: APPLY_FLOW_LOAD_RESULT kept local graph (server empty, local dirty)', {
      flowId,
      localNodeCount,
      serverNodeCount: serverNodes.length,
    });
  }
  logFlowHydrationTrace('FlowStore APPLY_FLOW_LOAD_RESULT applied', {
    flowId,
    localNodeCountBefore,
    localEdgeCountBefore,
    localNodeCountAfter: (nextNodes as any[])?.length ?? 0,
    localEdgeCountAfter: (nextEdges as any[])?.length ?? 0,
    serverNodeCount: serverNodes.length,
    serverEdgeCount: ((payload.edges as any[]) ?? []).length,
    keepLocalGraph,
    serverHydrationApplied: true,
  });
  logFlowSaveDebug('FlowStore: FIX-MAIN-EMPTY APPLY_FLOW_LOAD_RESULT applied', {
    flowId,
    localNodeCountBefore,
    localEdgeCountBefore,
    localNodeCountAfter: (nextNodes as any[])?.length ?? 0,
    localEdgeCountAfter: (nextEdges as any[])?.length ?? 0,
    serverNodeCount: serverNodes.length,
    serverEdgeCount: ((payload.edges as any[]) ?? []).length,
    keepLocalGraph,
  });
  if (isSubflowCanvasDebugEnabled()) {
    logSubflowCanvasDebug('FlowStore:APPLY_FLOW_LOAD_RESULT', {
      flowId,
      keepLocalGraph,
      serverNodeCount: serverNodes.length,
      serverEdgeCount: ((payload.edges as any[]) ?? []).length,
      hadHydratedBefore: curr.hydrated === true,
      before: summarizeFlowSlice(curr as any, { rowIdsSample: true }),
      after: summarizeFlowSlice(flow as any, { rowIdsSample: true }),
    });
  }
  return { ...state, flows: { ...state.flows, [flowId]: flow } };
}

export function reduceMarkFlowsVariablesReady<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowIds: FlowId[]
): WorkspaceState<NodeT, EdgeT> {
  const flows = { ...state.flows };
  for (const flowId of flowIds) {
    const f = flows[flowId];
    if (!f || f.hydrated !== true) continue;
    flows[flowId] = { ...f, variablesReady: true } as Flow<NodeT, EdgeT>;
  }
  return { ...state, flows };
}

export function reduceMarkFlowsPersisted<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowIds: FlowId[]
): WorkspaceState<NodeT, EdgeT> {
  const flows = { ...state.flows };
  for (const flowId of flowIds) {
    const f = flows[flowId];
    if (!f) continue;
    flows[flowId] = { ...f, hasLocalChanges: false, hydrated: true } as Flow<NodeT, EdgeT>;
  }
  return { ...state, flows };
}

export function reduceOpenFlow<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowId: FlowId
): WorkspaceState<NodeT, EdgeT> {
  if (state.openFlows.includes(flowId)) return { ...state, activeFlowId: flowId };
  return { ...state, openFlows: [...state.openFlows, flowId], activeFlowId: flowId };
}

export function reduceOpenFlowBackground<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowId: FlowId
): WorkspaceState<NodeT, EdgeT> {
  if (state.openFlows.includes(flowId)) return state;
  return { ...state, openFlows: [...state.openFlows, flowId] };
}

export function reduceCloseFlow<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowId: FlowId
): WorkspaceState<NodeT, EdgeT> {
  const openFlows = state.openFlows.filter((id) => id !== flowId);
  const activeFlowId =
    state.activeFlowId === flowId ? openFlows[openFlows.length - 1] || 'main' : state.activeFlowId;
  return { ...state, openFlows, activeFlowId };
}

export function reduceSetActiveFlow<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowId: FlowId
): WorkspaceState<NodeT, EdgeT> {
  return {
    ...state,
    activeFlowId: flowId,
    openFlows: state.openFlows.includes(flowId) ? state.openFlows : [...state.openFlows, flowId],
  };
}

export function reduceRenameFlow<NodeT = any, EdgeT = any>(
  state: WorkspaceState<NodeT, EdgeT>,
  flowId: FlowId,
  title: string
): WorkspaceState<NodeT, EdgeT> {
  const curr = state.flows[flowId];
  if (!curr) return state;
  const flow = { ...curr, title } as Flow<NodeT, EdgeT>;
  return { ...state, flows: { ...state.flows, [flowId]: flow } };
}
