import React, { createContext, useContext, useLayoutEffect, useMemo, useReducer } from 'react';
import { takeWorkspaceRestoreForProjectOnce } from '../services/project-save/flowSaveSnapshot';
import { logFlowSaveDebug } from '../utils/flowSaveDebug';
import type { Flow, FlowId, WorkspaceState } from './FlowTypes';

type ApplyFlowLoadPayload<NodeT, EdgeT> = {
  nodes: NodeT[];
  edges: EdgeT[];
  meta?: { variables?: unknown[] };
};

type Action<NodeT = any, EdgeT = any> =
  | { type: 'UPSERT_FLOW'; flow: Flow<NodeT, EdgeT> }
  | { type: 'UPDATE_FLOW_GRAPH'; flowId: FlowId; updater: (nodes: NodeT[], edges: EdgeT[]) => { nodes: NodeT[]; edges: EdgeT[] } }
  | { type: 'UPDATE_FLOW_META'; flowId: FlowId; patch: Record<string, unknown> }
  | { type: 'APPLY_FLOW_LOAD_RESULT'; flowId: FlowId; payload: ApplyFlowLoadPayload<NodeT, EdgeT> }
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
      const nonEmpty = (inc.nodes?.length ?? 0) > 0 || (inc.edges?.length ?? 0) > 0;
      const flow = {
        ...inc,
        hydrated: inc.hydrated !== undefined ? inc.hydrated : (prev?.hydrated ?? false),
        hasLocalChanges:
          inc.hasLocalChanges !== undefined
            ? inc.hasLocalChanges
            : prev !== undefined
              ? (prev.hasLocalChanges ?? false)
              : nonEmpty,
      } as Flow<NodeT, EdgeT>;
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
      const flow = {
        ...curr,
        meta: { ...prevMeta, ...action.patch } as Flow<NodeT, EdgeT>['meta'],
        hasLocalChanges: true,
      } as Flow<NodeT, EdgeT>;
      return { ...state, flows: { ...state.flows, [action.flowId]: flow } };
    }
    case 'APPLY_FLOW_LOAD_RESULT': {
      const curr = state.flows[action.flowId];
      if (!curr) return state;
      if (curr.hydrated === true) return state;
      const p = action.payload;
      const mergedMeta =
        p.meta !== undefined ? { ...curr.meta, ...p.meta } : curr.meta;
      const flow = {
        ...curr,
        nodes: p.nodes as any,
        edges: p.edges as any,
        ...(mergedMeta !== undefined ? { meta: mergedMeta } : {}),
        hydrated: true,
        hasLocalChanges: false,
      } as Flow<NodeT, EdgeT>;
      return { ...state, flows: { ...state.flows, [action.flowId]: flow } };
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
          hasLocalChanges: false,
        },
      },
      openFlows: ['main'],
      activeFlowId: 'main',
    }),
    []
  );

  const [state, dispatch] = useReducer(reducer as any, initial);

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

