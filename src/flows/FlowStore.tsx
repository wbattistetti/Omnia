import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer } from 'react';
import { takeWorkspaceRestoreForProjectOnce } from '../services/project-save/flowSaveSnapshot';
import { mergeFlowMetaOnServerLoad, shouldKeepLocalGraphOnEmptyServerResponse } from './flowLoadMergePolicy';
import { logFlowSaveDebug } from '../utils/flowSaveDebug';
import { logFlowHydrationTrace } from '../utils/flowHydrationTrace';
import { logTaskSubflowMove } from '../utils/taskSubflowMoveDebug';
import { isSubflowCanvasDebugEnabled, logSubflowCanvasDebug, summarizeFlowSlice } from '../utils/subflowCanvasDebug';
import type { Flow, FlowId, WorkspaceState } from './FlowTypes';
import type { Task } from '../types/taskTypes';
import type { VariableInstance } from '../types/variableTypes';
import type { FlowSubflowBindingPersisted } from '../domain/flowDocument/FlowDocument';
import { stripLegacyVariablesFromFlowMeta } from './flowMetaSanitize';

type ApplyFlowLoadPayload<NodeT, EdgeT> = {
  nodes: NodeT[];
  edges: EdgeT[];
  meta?: Flow['meta'];
  tasks?: Task[];
  variables?: VariableInstance[];
  bindings?: FlowSubflowBindingPersisted[];
};

type Action<NodeT = any, EdgeT = any> =
  | { type: 'UPSERT_FLOW'; flow: Flow<NodeT, EdgeT> }
  | { type: 'UPDATE_FLOW_GRAPH'; flowId: FlowId; updater: (nodes: NodeT[], edges: EdgeT[]) => { nodes: NodeT[]; edges: EdgeT[] } }
  | { type: 'UPDATE_FLOW_META'; flowId: FlowId; patch: Record<string, unknown> }
  | { type: 'APPLY_FLOW_LOAD_RESULT'; flowId: FlowId; payload: ApplyFlowLoadPayload<NodeT, EdgeT> }
  | { type: 'MARK_FLOWS_VARIABLES_READY'; flowIds: FlowId[] }
  | { type: 'MARK_FLOWS_PERSISTED'; flowIds: FlowId[] }
  | { type: 'OPEN_FLOW'; flowId: FlowId }
  | { type: 'OPEN_FLOW_BACKGROUND'; flowId: FlowId }
  | { type: 'CLOSE_FLOW'; flowId: FlowId }
  | { type: 'SET_ACTIVE_FLOW'; flowId: FlowId }
  | { type: 'RENAME_FLOW'; flowId: FlowId; title: string };

function reducer<NodeT = any, EdgeT = any>(state: WorkspaceState<NodeT, EdgeT>, action: Action<NodeT, EdgeT>): WorkspaceState<NodeT, EdgeT> {
  switch (action.type) {
    case 'UPSERT_FLOW': {
      const prev = state.flows[action.flow.id];
      const inc = action.flow;
      const fid = String(action.flow.id || '');

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

      const nonEmpty =
        (incMerged.nodes?.length ?? 0) > 0 || (incMerged.edges?.length ?? 0) > 0;
      const mergedForUpsert = { ...incMerged } as Flow<NodeT, EdgeT>;
      if (mergedForUpsert.meta !== undefined) {
        const metaAfterMerge =
          prev !== undefined
            ? mergeFlowMetaOnServerLoad({
                flowId: action.flow.id,
                localMeta: prev.meta,
                serverMeta: mergedForUpsert.meta,
                hasLocalChanges:
                  prev.hasLocalChanges === true ? true : mergedForUpsert.hasLocalChanges,
              })
            : mergedForUpsert.meta;
        mergedForUpsert.meta = stripLegacyVariablesFromFlowMeta(metaAfterMerge);
      }
      const flow = {
        ...mergedForUpsert,
        tasks: mergedForUpsert.tasks ?? prev?.tasks,
        variables: mergedForUpsert.variables ?? prev?.variables,
        bindings: mergedForUpsert.bindings ?? prev?.bindings,
        hydrated: mergedForUpsert.hydrated !== undefined ? mergedForUpsert.hydrated : (prev?.hydrated ?? false),
        variablesReady:
          mergedForUpsert.variablesReady !== undefined
            ? mergedForUpsert.variablesReady
            : (prev?.variablesReady ?? false),
        hasLocalChanges:
          mergedForUpsert.hasLocalChanges !== undefined
            ? mergedForUpsert.hasLocalChanges
            : prev !== undefined
              ? (prev.hasLocalChanges ?? false)
              : nonEmpty,
        // FIX-MAIN-EMPTY — preserve or set flag when upsert includes it (e.g. load path).
        serverHydrationApplied:
          mergedForUpsert.serverHydrationApplied !== undefined
            ? mergedForUpsert.serverHydrationApplied
            : (prev?.serverHydrationApplied ?? false),
      } as Flow<NodeT, EdgeT>;
      if (isSubflowCanvasDebugEnabled() && fid.startsWith('subflow_')) {
        logSubflowCanvasDebug('FlowStore:UPSERT_FLOW', {
          flowId: action.flow.id,
          incomingHydrated: inc.hydrated,
          incomingHasLocalChanges: inc.hasLocalChanges,
          merged: summarizeFlowSlice(flow as any, { rowIdsSample: true }),
        });
      }
      const flows = { ...state.flows, [action.flow.id]: flow };
      return { ...state, flows };
    }
    case 'UPDATE_FLOW_GRAPH': {
      const curr = state.flows[action.flowId];
      if (!curr) return state;
      const next = action.updater(curr.nodes as any[], curr.edges as any[]);
      const flow = {
        ...curr,
        nodes: next.nodes as any,
        edges: next.edges as any,
        hasLocalChanges: true,
      } as Flow<NodeT, EdgeT>;
      return { ...state, flows: { ...state.flows, [action.flowId]: flow } };
    }
    case 'UPDATE_FLOW_META': {
      const curr = state.flows[action.flowId];
      if (!curr) return state;
      const prevMeta = (curr.meta && typeof curr.meta === 'object' ? curr.meta : {}) as Record<string, unknown>;
      const patch = { ...action.patch } as Record<string, unknown>;
      delete patch.variables;
      const flow = {
        ...curr,
        meta: stripLegacyVariablesFromFlowMeta({ ...prevMeta, ...patch }) as Flow<NodeT, EdgeT>['meta'],
        hasLocalChanges: true,
      } as Flow<NodeT, EdgeT>;
      return { ...state, flows: { ...state.flows, [action.flowId]: flow } };
    }
    case 'APPLY_FLOW_LOAD_RESULT': {
      const curr = state.flows[action.flowId];
      if (!curr) {
        logFlowSaveDebug('FlowStore: FIX-MAIN-EMPTY APPLY_FLOW_LOAD_RESULT noop (missing slice)', {
          flowId: action.flowId,
        });
        if (isSubflowCanvasDebugEnabled()) {
          logSubflowCanvasDebug('FlowStore:APPLY_FLOW_LOAD_RESULT noop (missing slice)', {
            flowId: action.flowId,
          });
        }
        return state;
      }
      const localNodeCountBefore = curr.nodes?.length ?? 0;
      const localEdgeCountBefore = curr.edges?.length ?? 0;
      const localGraphNonEmpty = localNodeCountBefore > 0 || localEdgeCountBefore > 0;
      // FIX-MAIN-EMPTY — Ignore server only when hydrated AND local graph already has content; if local is empty, apply server payload.
      if (curr.hydrated === true && localGraphNonEmpty) {
        logFlowHydrationTrace('FlowStore APPLY_FLOW_LOAD_RESULT noop (hydrated + local graph non-empty)', {
          flowId: action.flowId,
          localNodeCountBefore,
          localEdgeCountBefore,
        });
        logFlowSaveDebug('FlowStore: FIX-MAIN-EMPTY APPLY_FLOW_LOAD_RESULT noop (hydrated + non-empty local graph)', {
          flowId: action.flowId,
          localNodeCountBefore,
          localEdgeCountBefore,
        });
        if (isSubflowCanvasDebugEnabled()) {
          logSubflowCanvasDebug('FlowStore:APPLY_FLOW_LOAD_RESULT noop (hydrated_with_graph)', {
            flowId: action.flowId,
            ...summarizeFlowSlice(curr as any, { rowIdsSample: true }),
          });
        }
        return state;
      }
      if (curr.hydrated === true && !localGraphNonEmpty) {
        logFlowHydrationTrace('FlowStore: applying server payload (hydrated but local graph empty)', {
          flowId: action.flowId,
          hydrated: curr.hydrated,
          serverHydrationAppliedBefore: curr.serverHydrationApplied ?? false,
        });
        logFlowSaveDebug('FlowStore: FIX-MAIN-EMPTY APPLY_FLOW_LOAD_RESULT apply server while local graph empty', {
          flowId: action.flowId,
          hydrated: curr.hydrated,
          serverHydrationAppliedBefore: curr.serverHydrationApplied ?? false,
        });
      }
      const p = action.payload;
      const serverNodes = (p.nodes as any[]) ?? [];
      const serverEdges = (p.edges as any[]) ?? [];
      const localNodeCount = curr.nodes?.length ?? 0;
      const keepLocalGraph = shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: serverNodes.length,
        localNodeCount,
        hasLocalChanges: curr.hasLocalChanges,
        flowId: action.flowId,
      });
      const nextNodes = keepLocalGraph ? (curr.nodes as any[]) : serverNodes;
      const nextEdges = keepLocalGraph ? (curr.edges as any[]) : serverEdges;
      const mergedMeta = stripLegacyVariablesFromFlowMeta(
        mergeFlowMetaOnServerLoad({
          flowId: action.flowId,
          localMeta: curr.meta,
          serverMeta: p.meta,
          hasLocalChanges: curr.hasLocalChanges,
        })
      );
      const flow = {
        ...curr,
        nodes: nextNodes as any,
        edges: nextEdges as any,
        meta: mergedMeta,
        ...(Array.isArray(p.tasks) ? { tasks: p.tasks } : {}),
        ...(Array.isArray(p.variables) ? { variables: p.variables } : {}),
        ...(Array.isArray(p.bindings) ? { bindings: p.bindings } : {}),
        hydrated: true,
        variablesReady: false,
        hasLocalChanges: keepLocalGraph ? true : false,
        // FIX-MAIN-EMPTY — Marks that server payload was merged (enables policy to stop refetch on legit empty projects).
        serverHydrationApplied: true,
      } as Flow<NodeT, EdgeT>;
      if (keepLocalGraph) {
        logFlowSaveDebug('FlowStore: APPLY_FLOW_LOAD_RESULT kept local graph (server empty, local dirty)', {
          flowId: action.flowId,
          localNodeCount,
          serverNodeCount: serverNodes.length,
        });
      }
      logFlowHydrationTrace('FlowStore APPLY_FLOW_LOAD_RESULT applied', {
        flowId: action.flowId,
        localNodeCountBefore,
        localEdgeCountBefore,
        localNodeCountAfter: (nextNodes as any[])?.length ?? 0,
        localEdgeCountAfter: (nextEdges as any[])?.length ?? 0,
        serverNodeCount: serverNodes.length,
        serverEdgeCount: ((p.edges as any[]) ?? []).length,
        keepLocalGraph,
        serverHydrationApplied: true,
      });
      logFlowSaveDebug('FlowStore: FIX-MAIN-EMPTY APPLY_FLOW_LOAD_RESULT applied', {
        flowId: action.flowId,
        localNodeCountBefore,
        localEdgeCountBefore,
        localNodeCountAfter: (nextNodes as any[])?.length ?? 0,
        localEdgeCountAfter: (nextEdges as any[])?.length ?? 0,
        serverNodeCount: serverNodes.length,
        serverEdgeCount: ((p.edges as any[]) ?? []).length,
        keepLocalGraph,
      });
      if (isSubflowCanvasDebugEnabled()) {
        logSubflowCanvasDebug('FlowStore:APPLY_FLOW_LOAD_RESULT', {
          flowId: action.flowId,
          keepLocalGraph,
          serverNodeCount: serverNodes.length,
          serverEdgeCount: ((p.edges as any[]) ?? []).length,
          hadHydratedBefore: curr.hydrated === true,
          before: summarizeFlowSlice(curr as any, { rowIdsSample: true }),
          after: summarizeFlowSlice(flow as any, { rowIdsSample: true }),
        });
      }
      return { ...state, flows: { ...state.flows, [action.flowId]: flow } };
    }
    case 'MARK_FLOWS_VARIABLES_READY': {
      const flows = { ...state.flows };
      for (const flowId of action.flowIds) {
        const f = flows[flowId];
        if (!f || f.hydrated !== true) continue;
        flows[flowId] = { ...f, variablesReady: true } as Flow<NodeT, EdgeT>;
      }
      return { ...state, flows };
    }
    case 'MARK_FLOWS_PERSISTED': {
      const flows = { ...state.flows };
      for (const flowId of action.flowIds) {
        const f = flows[flowId];
        if (!f) continue;
        flows[flowId] = { ...f, hasLocalChanges: false, hydrated: true } as Flow<NodeT, EdgeT>;
      }
      return { ...state, flows };
    }
    case 'OPEN_FLOW': {
      if (state.openFlows.includes(action.flowId)) return { ...state, activeFlowId: action.flowId };
      return { ...state, openFlows: [...state.openFlows, action.flowId], activeFlowId: action.flowId };
    }
    case 'OPEN_FLOW_BACKGROUND': {
      if (state.openFlows.includes(action.flowId)) return state;
      return { ...state, openFlows: [...state.openFlows, action.flowId] };
    }
    case 'CLOSE_FLOW': {
      const openFlows = state.openFlows.filter(id => id !== action.flowId);
      const activeFlowId = state.activeFlowId === action.flowId ? (openFlows[openFlows.length - 1] || 'main') : state.activeFlowId;
      return { ...state, openFlows, activeFlowId };
    }
    case 'SET_ACTIVE_FLOW': {
      return { ...state, activeFlowId: action.flowId, openFlows: state.openFlows.includes(action.flowId) ? state.openFlows : [...state.openFlows, action.flowId] };
    }
    case 'RENAME_FLOW': {
      const curr = state.flows[action.flowId];
      if (!curr) return state;
      const flow = { ...curr, title: action.title } as Flow<NodeT, EdgeT>;
      return { ...state, flows: { ...state.flows, [action.flowId]: flow } };
    }
    default:
      return state;
  }
}

const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);
const WorkspaceDispatchContext = createContext<React.Dispatch<Action> | undefined>(undefined);

/**
 * In-memory flow workspace (draft when no project is selected). Persistence is gated in FlowPersistence
 * (loadFlow/saveFlow no-op without projectId); graph edits use UPDATE_FLOW_GRAPH / UPSERT_FLOW only.
 * Step 3: `hydrated` gates repeat loadFlow; first load applies server data (see flowHydrationPolicy).
 *
 * @param workspaceProjectId - Current catalog project id; used to restore a post-draft-commit snapshot (see flowSaveSnapshot).
 */
export function FlowWorkspaceProvider({
  children,
  workspaceProjectId,
}: {
  children: React.ReactNode;
  workspaceProjectId?: string | null;
}) {
  const initial: WorkspaceState = useMemo(
    () => ({
      flows: {
        main: {
          id: 'main',
          title: 'Main',
          nodes: [],
          edges: [],
          hydrated: false,
          variablesReady: false,
          hasLocalChanges: false,
        },
      },
      openFlows: ['main'],
      activeFlowId: 'main',
    }),
    []
  );

  const [state, dispatch] = useReducer(reducer as any, initial);

  useEffect(() => {
    const onHydrated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ flowIds?: string[] }>).detail;
      const flowIds = Array.isArray(detail?.flowIds) ? detail.flowIds : [];
      if (flowIds.length === 0) return;
      dispatch({ type: 'MARK_FLOWS_VARIABLES_READY', flowIds } as any);
    };
    document.addEventListener('omnia:flowVariablesHydrated', onHydrated);
    return () => document.removeEventListener('omnia:flowVariablesHydrated', onHydrated);
  }, []);

  useLayoutEffect(() => {
    const pid = workspaceProjectId != null ? String(workspaceProjectId).trim() : '';
    if (!pid) return;
    const pending = takeWorkspaceRestoreForProjectOnce(pid);
    if (!pending || Object.keys(pending).length === 0) return;
    for (const [flowId, raw] of Object.entries(pending)) {
      const f = raw as Record<string, unknown>;
      const nodes = Array.isArray(f?.nodes) ? (f.nodes as unknown[]) : [];
      const edges = Array.isArray(f?.edges) ? (f.edges as unknown[]) : [];
      const titleRaw = f?.title;
      const title =
        typeof titleRaw === 'string' && titleRaw.trim().length > 0
          ? titleRaw.trim()
          : flowId === 'main'
            ? 'Main'
            : flowId;
      dispatch({
        type: 'UPSERT_FLOW',
        flow: {
          id: flowId,
          title,
          nodes,
          edges,
          ...(f?.meta !== undefined && typeof f.meta === 'object' ? { meta: f.meta } : {}),
          hydrated: true,
          variablesReady: false,
          hasLocalChanges: true,
        },
      } as any);
    }
    logFlowSaveDebug('FlowWorkspaceProvider: restored post-draft snapshot (useLayoutEffect)', {
      projectId: pid,
      flowIds: Object.keys(pending),
      perFlow: Object.entries(pending).map(([id, raw]) => {
        const r = raw as Record<string, unknown>;
        return {
          flowId: id,
          nodes: Array.isArray(r?.nodes) ? r.nodes.length : 0,
          edges: Array.isArray(r?.edges) ? r.edges.length : 0,
        };
      }),
    });
  }, [workspaceProjectId]);

  return (
    <WorkspaceContext.Provider value={state}>
      <WorkspaceDispatchContext.Provider value={dispatch}>{children}</WorkspaceDispatchContext.Provider>
    </WorkspaceContext.Provider>
  );
}

export function useFlowWorkspace<NodeT = any, EdgeT = any>(): WorkspaceState<NodeT, EdgeT> {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useFlowWorkspace must be used within FlowWorkspaceProvider');
  return ctx as any;
}

export function useFlowActions<NodeT = any, EdgeT = any>() {
  const dispatch = useContext(WorkspaceDispatchContext);
  if (!dispatch) throw new Error('useFlowActions must be used within FlowWorkspaceProvider');
  return useMemo(
    () => ({
      upsertFlow: (flow: Flow<NodeT, EdgeT>) => dispatch({ type: 'UPSERT_FLOW', flow } as any),
      updateFlowGraph: (flowId: FlowId, updater: (nodes: NodeT[], edges: EdgeT[]) => { nodes: NodeT[]; edges: EdgeT[] }) =>
        dispatch({ type: 'UPDATE_FLOW_GRAPH', flowId, updater } as any),
      updateFlowMeta: (flowId: FlowId, patch: Record<string, unknown>) =>
        dispatch({ type: 'UPDATE_FLOW_META', flowId, patch } as any),
      applyFlowLoadResult: (flowId: FlowId, payload: ApplyFlowLoadPayload<NodeT, EdgeT>) =>
        dispatch({ type: 'APPLY_FLOW_LOAD_RESULT', flowId, payload } as any),
      markFlowsVariablesReady: (flowIds: FlowId[]) => dispatch({ type: 'MARK_FLOWS_VARIABLES_READY', flowIds } as any),
      markFlowsPersisted: (flowIds: FlowId[]) => dispatch({ type: 'MARK_FLOWS_PERSISTED', flowIds } as any),
      openFlow: (flowId: FlowId) => dispatch({ type: 'OPEN_FLOW', flowId } as any),
      openFlowBackground: (flowId: FlowId) => dispatch({ type: 'OPEN_FLOW_BACKGROUND', flowId } as any),
      closeFlow: (flowId: FlowId) => dispatch({ type: 'CLOSE_FLOW', flowId } as any),
      setActiveFlow: (flowId: FlowId) => dispatch({ type: 'SET_ACTIVE_FLOW', flowId } as any),
      renameFlow: (flowId: FlowId, title: string) => dispatch({ type: 'RENAME_FLOW', flowId, title } as any),
    }),
    [dispatch]
  );
}

