// Tipi per lo stato dell'editor
export interface EditorState {
  selectedStep: string; // Miglioria: sempre string, mai null
  selectedNodeIndex: number | null;
  nodes: any[];
  actionCatalog: any[];
  showLabel: boolean; // ✅ NUOVO: aggiunto showLabel
}

// Azioni del reducer
export type EditorAction = 
  | { type: 'SET_STEP'; step: string }
  | { type: 'SET_SELECTED_NODE_INDEX'; index: number | null }
  | { type: 'SET_NODES'; nodes: any[] }
  | { type: 'SET_ACTION_CATALOG'; catalog: any[] }
  | { type: 'REMOVE_NODE'; id: string }
  | { type: 'SET_SHOW_LABEL'; value: boolean }
  | { type: 'ADD_NODE'; node: any } // ✅ NUOVO: aggiunta azione
  | { type: 'ADD_ESCALATION' }; // ✅ NUOVO: aggiunta escalation

// Reducer per gestire lo stato
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, selectedStep: action.step };
    case 'SET_SELECTED_NODE_INDEX':
      return { ...state, selectedNodeIndex: action.index };
    case 'SET_NODES':
      return { ...state, nodes: action.nodes };
    case 'SET_ACTION_CATALOG':
      return { ...state, actionCatalog: action.catalog };
    case 'REMOVE_NODE':
      return {
        ...state,
        nodes: state.nodes.filter(n => n.id !== action.id)
      };
    case 'SET_SHOW_LABEL': // ✅ NUOVO: aggiunto case
      return { ...state, showLabel: action.value };
    case 'ADD_NODE': // ✅ NUOVO: aggiunto case
      return { ...state, nodes: [...state.nodes, action.node] };
    case 'ADD_ESCALATION': // ✅ NUOVO: aggiunto case
      if (!state.selectedStep) return state;
      const escalationId = `${state.selectedStep}_escalation_${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...state,
        nodes: [...state.nodes, {
          id: escalationId,
          text: 'recovery',
          type: 'escalation',
          level: 0,
          included: true,
          stepType: state.selectedStep
        }]
      };
    default:
      return state;
  }
}

// Stato iniziale
export const initialState: EditorState = {
  selectedStep: 'start',
  selectedNodeIndex: null,
  nodes: [],
  actionCatalog: [],
  showLabel: true // ✅ NUOVO: aggiunto showLabel
}; 