import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { Flow, FlowId, WorkspaceState } from './FlowTypes';

type Action<NodeT = any, EdgeT = any> =
  | { type: 'UPSERT_FLOW'; flow: Flow<NodeT, EdgeT> }
  | { type: 'UPDATE_FLOW_GRAPH'; flowId: FlowId; updater: (nodes: NodeT[], edges: EdgeT[]) => { nodes: NodeT[]; edges: EdgeT[] } }
  | { type: 'OPEN_FLOW'; flowId: FlowId }
  | { type: 'CLOSE_FLOW'; flowId: FlowId }
  | { type: 'SET_ACTIVE_FLOW'; flowId: FlowId }
  | { type: 'RENAME_FLOW'; flowId: FlowId; title: string };

function reducer<NodeT = any, EdgeT = any>(state: WorkspaceState<NodeT, EdgeT>, action: Action<NodeT, EdgeT>): WorkspaceState<NodeT, EdgeT> {
  switch (action.type) {
    case 'UPSERT_FLOW': {
      const flows = { ...state.flows, [action.flow.id]: action.flow };
      return { ...state, flows };
    }
    case 'UPDATE_FLOW_GRAPH': {
      const curr = state.flows[action.flowId];
      if (!curr) return state;
      const next = action.updater(curr.nodes as any[], curr.edges as any[]);
      const flow = { ...curr, nodes: next.nodes as any, edges: next.edges as any } as Flow<NodeT, EdgeT>;
      return { ...state, flows: { ...state.flows, [action.flowId]: flow } };
    }
    case 'OPEN_FLOW': {
      if (state.openFlows.includes(action.flowId)) return { ...state, activeFlowId: action.flowId };
      return { ...state, openFlows: [...state.openFlows, action.flowId], activeFlowId: action.flowId };
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

export function FlowWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const initial: WorkspaceState = useMemo(() => ({
    flows: { main: { id: 'main', title: 'Main', nodes: [], edges: [] } },
    openFlows: ['main'],
    activeFlowId: 'main',
  }), []);

  const [state, dispatch] = useReducer(reducer as any, initial);

  return (
    React.createElement(WorkspaceContext.Provider, { value: state },
      React.createElement(WorkspaceDispatchContext.Provider, { value: dispatch }, children)
    )
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
  return {
    upsertFlow: (flow: Flow<NodeT, EdgeT>) => dispatch({ type: 'UPSERT_FLOW', flow } as any),
    updateFlowGraph: (flowId: FlowId, updater: (nodes: NodeT[], edges: EdgeT[]) => { nodes: NodeT[]; edges: EdgeT[] }) => dispatch({ type: 'UPDATE_FLOW_GRAPH', flowId, updater } as any),
    openFlow: (flowId: FlowId) => dispatch({ type: 'OPEN_FLOW', flowId } as any),
    closeFlow: (flowId: FlowId) => dispatch({ type: 'CLOSE_FLOW', flowId } as any),
    setActiveFlow: (flowId: FlowId) => dispatch({ type: 'SET_ACTIVE_FLOW', flowId } as any),
    renameFlow: (flowId: FlowId, title: string) => dispatch({ type: 'RENAME_FLOW', flowId, title } as any),
  } as const;
}


