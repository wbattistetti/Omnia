import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  WorkspaceContext,
  WorkspaceDispatchContext,
  WorkspaceSnapshotRefContext,
} from './flowWorkspaceReactContext';
import { takeWorkspaceRestoreForProjectOnce } from '../services/project-save/flowSaveSnapshot';
import { logFlowSaveDebug } from '../utils/flowSaveDebug';
import type { Flow, FlowId, WorkspaceState } from './FlowTypes';
import type { ApplyFlowLoadPayload } from './ApplyFlowLoadPayload';
import type { ApplyWorkspaceMachineEventOutcome } from '@domain/flowStateMachine/applyWorkspaceMachineEvent';
import { applyWorkspaceMachineEvent } from '@domain/flowStateMachine/applyWorkspaceMachineEvent';
import type { WorkspaceMachineEvent } from '@domain/flowStateMachine/WorkspaceMachineEvents';
import {
  reduceApplyFlowLoadResult,
  reduceCloseFlow,
  reduceMarkFlowsPersisted,
  reduceMarkFlowsVariablesReady,
  reduceOpenFlow,
  reduceOpenFlowBackground,
  reduceRenameFlow,
  reduceSetActiveFlow,
} from './workspaceTransitions';
import { setSubflowSyncFlows } from '@domain/taskSubflowMove/subflowSyncFlowsRef';

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
  | { type: 'RENAME_FLOW'; flowId: FlowId; title: string }
  | { type: 'APPLY_WORKSPACE_MACHINE_EVENT'; event: WorkspaceMachineEvent<NodeT, EdgeT> }
  /**
   * Internal: workspace already computed by {@link applyWorkspaceMachineEvent} outside the reducer
   * (structural transactional path). Reducer stays a pure snapshot replace.
   */
  | { type: 'COMMIT_WORKSPACE_SNAPSHOT'; workspace: WorkspaceState<NodeT, EdgeT> };

function reducer<NodeT = any, EdgeT = any>(state: WorkspaceState<NodeT, EdgeT>, action: Action<NodeT, EdgeT>): WorkspaceState<NodeT, EdgeT> {
  switch (action.type) {
    case 'UPSERT_FLOW':
      return applyWorkspaceMachineEvent(state, { type: 'upsertFlow', flow: action.flow }).workspace;
    case 'UPDATE_FLOW_GRAPH':
      return applyWorkspaceMachineEvent(state, {
        type: 'updateFlowGraph',
        flowId: action.flowId,
        updater: action.updater,
      }).workspace;
    case 'UPDATE_FLOW_META':
      return applyWorkspaceMachineEvent(state, {
        type: 'updateFlowMeta',
        flowId: action.flowId,
        patch: action.patch,
      }).workspace;
    case 'APPLY_FLOW_LOAD_RESULT':
      return reduceApplyFlowLoadResult(state, action.flowId, action.payload);
    case 'MARK_FLOWS_VARIABLES_READY':
      return reduceMarkFlowsVariablesReady(state, action.flowIds);
    case 'MARK_FLOWS_PERSISTED':
      return reduceMarkFlowsPersisted(state, action.flowIds);
    case 'OPEN_FLOW':
      return reduceOpenFlow(state, action.flowId);
    case 'OPEN_FLOW_BACKGROUND':
      return reduceOpenFlowBackground(state, action.flowId);
    case 'CLOSE_FLOW':
      return reduceCloseFlow(state, action.flowId);
    case 'SET_ACTIVE_FLOW':
      return reduceSetActiveFlow(state, action.flowId);
    case 'RENAME_FLOW':
      return reduceRenameFlow(state, action.flowId, action.title);
    case 'APPLY_WORKSPACE_MACHINE_EVENT':
      return applyWorkspaceMachineEvent(state, action.event).workspace;
    case 'COMMIT_WORKSPACE_SNAPSHOT':
      return action.workspace;
    default:
      return state;
  }
}

/**
 * In-memory flow workspace (draft when no project is selected). Persistence is gated in FlowPersistence
 * (loadFlow/saveFlow no-op without projectId); graph edits go through the workspace machine (`applyWorkspaceMachineEvent`).
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
  const workspaceSnapshotRef = useRef<WorkspaceState>(initial);
  workspaceSnapshotRef.current = state;

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
        type: 'APPLY_WORKSPACE_MACHINE_EVENT',
        event: {
          type: 'upsertFlow',
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
      <WorkspaceDispatchContext.Provider value={dispatch}>
        <WorkspaceSnapshotRefContext.Provider value={workspaceSnapshotRef}>
          {children}
        </WorkspaceSnapshotRefContext.Provider>
      </WorkspaceDispatchContext.Provider>
    </WorkspaceContext.Provider>
  );
}

export function useFlowWorkspace<NodeT = any, EdgeT = any>(): WorkspaceState<NodeT, EdgeT> {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useFlowWorkspace must be used within FlowWorkspaceProvider');
  return ctx as any;
}

/** Like {@link useFlowWorkspace} but returns `undefined` outside {@link FlowWorkspaceProvider} (demo / isolated editors). */
export function useFlowWorkspaceOptional<NodeT = any, EdgeT = any>(): WorkspaceState<NodeT, EdgeT> | undefined {
  return useContext(WorkspaceContext) as WorkspaceState<NodeT, EdgeT> | undefined;
}

/**
 * Applies a structural machine event once (pure domain), commits the resulting workspace snapshot when
 * the domain reports `flowStoreCommitOk`, and returns the envelope
 * synchronously — no module-level bridge.
 */
export function commitStructuralWorkspaceMachineEvent<NodeT, EdgeT>(params: {
  dispatch: React.Dispatch<Action<NodeT, EdgeT>>;
  getWorkspace: () => WorkspaceState<NodeT, EdgeT>;
  event: Extract<WorkspaceMachineEvent<NodeT, EdgeT>, { type: 'structuralCommand' }>;
}): ApplyWorkspaceMachineEventOutcome<NodeT, EdgeT> {
  const { dispatch, getWorkspace, event } = params;
  const out = applyWorkspaceMachineEvent(getWorkspace(), event);
  const s = out.structural;
  if (s?.flowStoreCommitOk === true) {
    dispatch({ type: 'COMMIT_WORKSPACE_SNAPSHOT', workspace: out.workspace } as Action<NodeT, EdgeT>);
    /** Align subflow/TaskRepository bridge immediately; DockManager render may lag one frame. */
    const flows = out.workspace?.flows;
    if (flows && typeof flows === 'object') {
      setSubflowSyncFlows(flows as WorkspaceState<NodeT, EdgeT>['flows']);
    }
  }
  return out;
}

export function useFlowActions<NodeT = any, EdgeT = any>() {
  const dispatch = useContext(WorkspaceDispatchContext);
  const workspaceRef = useContext(WorkspaceSnapshotRefContext);
  if (!dispatch) throw new Error('useFlowActions must be used within FlowWorkspaceProvider');
  if (!workspaceRef) throw new Error('useFlowActions must be used within FlowWorkspaceProvider');
  return useMemo(
    () => ({
      upsertFlow: (flow: Flow<NodeT, EdgeT>) =>
        dispatch({
          type: 'APPLY_WORKSPACE_MACHINE_EVENT',
          event: { type: 'upsertFlow', flow },
        } as any),
      updateFlowGraph: (flowId: FlowId, updater: (nodes: NodeT[], edges: EdgeT[]) => { nodes: NodeT[]; edges: EdgeT[] }) =>
        dispatch({
          type: 'APPLY_WORKSPACE_MACHINE_EVENT',
          event: { type: 'updateFlowGraph', flowId, updater },
        } as any),
      updateFlowMeta: (flowId: FlowId, patch: Record<string, unknown>) =>
        dispatch({
          type: 'APPLY_WORKSPACE_MACHINE_EVENT',
          event: { type: 'updateFlowMeta', flowId, patch },
        } as any),
      applyFlowLoadResult: (flowId: FlowId, payload: ApplyFlowLoadPayload<NodeT, EdgeT>) =>
        dispatch({ type: 'APPLY_FLOW_LOAD_RESULT', flowId, payload } as any),
      markFlowsVariablesReady: (flowIds: FlowId[]) => dispatch({ type: 'MARK_FLOWS_VARIABLES_READY', flowIds } as any),
      markFlowsPersisted: (flowIds: FlowId[]) => dispatch({ type: 'MARK_FLOWS_PERSISTED', flowIds } as any),
      applyWorkspaceMachineEvent: (event: WorkspaceMachineEvent<NodeT, EdgeT>) =>
        dispatch({ type: 'APPLY_WORKSPACE_MACHINE_EVENT', event } as any),
      /**
       * Structural DnD / orchestrator path: single pure apply + snapshot commit; returns `structural` synchronously.
       */
      applyStructuralWorkspaceMachineEvent: (
        event: Extract<WorkspaceMachineEvent<NodeT, EdgeT>, { type: 'structuralCommand' }>
      ) =>
        commitStructuralWorkspaceMachineEvent({
          dispatch: dispatch as React.Dispatch<Action<NodeT, EdgeT>>,
          getWorkspace: () => workspaceRef.current,
          event,
        }),
      openFlow: (flowId: FlowId) => dispatch({ type: 'OPEN_FLOW', flowId } as any),
      openFlowBackground: (flowId: FlowId) => dispatch({ type: 'OPEN_FLOW_BACKGROUND', flowId } as any),
      closeFlow: (flowId: FlowId) => dispatch({ type: 'CLOSE_FLOW', flowId } as any),
      setActiveFlow: (flowId: FlowId) => dispatch({ type: 'SET_ACTIVE_FLOW', flowId } as any),
      renameFlow: (flowId: FlowId, title: string) => dispatch({ type: 'RENAME_FLOW', flowId, title } as any),
    }),
    [dispatch, workspaceRef]
  );
}

