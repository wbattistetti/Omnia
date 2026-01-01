import { useReducer, useRef, useCallback } from 'react';
import { TreeNodeProps } from './types';
import { addNode, removeNodePure } from './treeFactories';
import { v4 as uuidv4 } from 'uuid';

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
  | { type: 'ADD_NODE'; node: TreeNodeProps }
  | { type: 'REMOVE_NODE'; id: string }
  | { type: 'ADD_ESCALATION' }
  | { type: 'TOGGLE_ESCALATION_INCLUDE'; id: string; included: boolean }
  | { type: 'SET_ALL_STATE'; state: EditorState };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
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
      const newNodes = addNode(state.nodes, action.node);
      return { ...state, nodes: newNodes };
    case 'REMOVE_NODE': {
      if (typeof action.id !== 'string') {
        return state;
      }
      const nodeToRemove = state.nodes.find(n => n.id === action.id);
      if (nodeToRemove && nodeToRemove.type === 'escalation') {
        return {
          ...state,
          nodes: removeNodePure(state.nodes, action.id, true)
        };
      } else {
        return {
          ...state,
          nodes: removeNodePure(state.nodes, action.id, false)
        };
      }
    }
    case 'ADD_ESCALATION': {
      if (!state.selectedStep) return state;
      const escalationId = `${state.selectedStep}_escalation_${uuidv4()}`;
      return {
        ...state,
        nodes: addNode(state.nodes, {
          id: escalationId,
          text: 'recovery',
          type: 'escalation',
          level: 0,
          included: true,
        })
      };
    }
    case 'TOGGLE_ESCALATION_INCLUDE':
      return {
        ...state,
        nodes: state.nodes.map(n =>
          n.id === action.id ? { ...n, included: action.included } : n
        )
      };
    case 'SET_ALL_STATE':
      return { ...action.state };
    default:
      return state;
  }
}

export function useEditorReducer(initialState: EditorState) {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const historyRef = useRef<EditorState[]>([initialState]);
  const indexRef = useRef(0);

  const dispatchWithHistory = useCallback((action: EditorAction) => {
    const newState = editorReducer(state, action);
    if (JSON.stringify(newState) !== JSON.stringify(state)) {
      const newHistory = historyRef.current.slice(0, indexRef.current + 1);
      newHistory.push(newState);
      historyRef.current = newHistory;
      indexRef.current = newHistory.length - 1;
    }
    dispatch(action);
  }, [state]);

  const undo = () => {
    if (indexRef.current > 0) {
      indexRef.current -= 1;
      dispatch({ type: 'SET_ALL_STATE', state: historyRef.current[indexRef.current] });
    }
  };

  const redo = () => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current += 1;
      dispatch({ type: 'SET_ALL_STATE', state: historyRef.current[indexRef.current] });
    }
  };

  return {
    state,
    dispatch: dispatchWithHistory,
    undo,
    redo,
    canUndo: indexRef.current > 0,
    canRedo: indexRef.current < historyRef.current.length - 1,
  };
} 