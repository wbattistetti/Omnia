// Executive summary: Custom hook for managing Response Editor state with reducer and history.
import { useReducer, useRef, useCallback } from 'react';
import { TreeNodeProps } from './types';
import { insertNodeAt } from './treeFactories';

export interface EditorState {
  selectedStep: string | null;
  actionCatalog: any[];
  showLabel: boolean;
  activeDragAction: any;
  nodes: TreeNodeProps[];
}

export type EditorAction =
  | { type: 'SET_STEP'; step: string }
  | { type: 'SET_ACTION_CATALOG'; catalog: any[] }
  | { type: 'SET_SHOW_LABEL'; show: boolean }
  | { type: 'SET_ACTIVE_DRAG_ACTION'; action: any }
  | { type: 'SET_NODES'; nodes: TreeNodeProps[] }
  | { type: 'ADD_NODE'; node: TreeNodeProps; targetId?: string; position?: 'before' | 'after' }
  | { type: 'REMOVE_NODE'; id: string }
  | { type: 'ADD_ESCALATION' }
  | { type: 'TOGGLE_ESCALATION_INCLUDE'; id: string; included: boolean };

const initialState: EditorState = {
  selectedStep: null,
  actionCatalog: [],
  showLabel: false,
  activeDragAction: null,
  nodes: []
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, selectedStep: action.step };
    case 'SET_ACTION_CATALOG':
      return { ...state, actionCatalog: action.catalog };
    case 'SET_SHOW_LABEL':
      return { ...state, showLabel: action.show };
    case 'SET_ACTIVE_DRAG_ACTION':
      return { ...state, activeDragAction: action.action };
    case 'SET_NODES':
      return { ...state, nodes: action.nodes };
    case 'ADD_NODE':
      if (action.targetId && action.position) {
        return { ...state, nodes: insertNodeAt(state.nodes, action.node, action.targetId, action.position) };
      }
      return { ...state, nodes: [...state.nodes, action.node] };
    case 'REMOVE_NODE':
      return { ...state, nodes: state.nodes.filter(n => n.id !== action.id) };
    case 'ADD_ESCALATION':
      const newEscalation: TreeNodeProps = {
        id: `escalation_${Date.now()}`,
        text: 'recovery',
        type: 'escalation',
        level: 0,
        included: true
      };
      return { ...state, nodes: [...state.nodes, newEscalation] };
    case 'TOGGLE_ESCALATION_INCLUDE':
      return {
        ...state,
        nodes: state.nodes.map(n => 
          n.id === action.id ? { ...n, included: action.included } : n
        )
      };
    default:
      return state;
  }
}

export function useResponseEditorState() {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const historyRef = useRef<EditorState[]>([]);
  const indexRef = useRef(-1);

  const dispatchWithHistory = useCallback((action: EditorAction) => {
    // Salva lo stato corrente nella history
    if (indexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    }
    historyRef.current.push(state);
    indexRef.current = historyRef.current.length - 1;

    // Limita la history a 50 stati
    if (historyRef.current.length > 50) {
      historyRef.current = historyRef.current.slice(-50);
      indexRef.current = historyRef.current.length - 1;
    }

    dispatch(action);
  }, [state]);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  const undo = useCallback(() => {
    if (canUndo) {
      indexRef.current -= 1;
      const previousState = historyRef.current[indexRef.current];
      dispatch({ type: 'SET_NODES', nodes: previousState.nodes });
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      indexRef.current += 1;
      const nextState = historyRef.current[indexRef.current];
      dispatch({ type: 'SET_NODES', nodes: nextState.nodes });
    }
  }, [canRedo]);

  return {
    state,
    dispatch: dispatchWithHistory,
    canUndo,
    canRedo,
    undo,
    redo
  };
} 