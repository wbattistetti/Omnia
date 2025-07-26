// REGOLA GLOBALE PER LE CHIAVI DI TRANSLATION DEI DDT (runtime):
// Formato:
//   runtime.<DDT_ID>.<step>[#<n>].<actionInstanceId>.text
// - <DDT_ID>: l'id del DataDialogueTemplate (es: DDT_BirthOfDate)
// - <step>: tipo di step (es: normal, noInput, noMatch, explicitConfirmation, success, ecc.)
// - [#<n>]: numero escalation (opzionale, parte da 1 se ci sono più azioni per step)
// - <actionInstanceId>: es. sayMessage2, askQuestion1, ecc.
// - .text: suffisso fisso per il testo principale
// Esempi:
//   runtime.DDT_BirthOfDate.normal#1.askQuestion1.text
//   runtime.DDT_BirthOfDate.noInput#1.sayMessage1.text
//   runtime.DDT_BirthOfDate.noMatch#2.sayMessageX.text
//   runtime.DDT_BirthOfDate.success#1.sayMessageSuccess.text
// Note: questa regola va rispettata sia negli script di inserimento/aggiornamento che nel codice di lookup delle translations.
//
// ---
// Executive summary: Main entry point for the Response Editor component. Handles layout and orchestration of the response tree.
import React, { useReducer, useEffect } from 'react';
import ResponseEditorUI from './ResponseEditorUI';
import ActionItem from '../ActionViewer/ActionItem';
import ActionList from '../ActionViewer/ActionList';
import { Tag, MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Clock, ServerCog, Calendar, MapPin, FileText, PlayCircle, MicOff, CheckCircle2, CheckSquare, AlertCircle, Plus } from 'lucide-react';
import ToolbarButton from './ToolbarButton';
import TreeView from './TreeView';
import styles from './ResponseEditor.module.css';
import { TreeNodeProps } from './types';
import { useTreeNodes } from './useTreeNodes';
import { useRef, useCallback } from 'react';
import { estraiNodiDaDDT, insertNodeAt, removeNodePure, addNode } from './treeFactories';
import { estraiParametroPrincipale, estraiValoreTradotto, getTranslationText, ordinalIt, estraiLabelAzione } from './responseEditorHelpers';
import { v4 as uuidv4 } from 'uuid';

const iconMap: Record<string, React.ReactNode> = {
  MessageCircle: <MessageCircle size={24} />,  HelpCircle: <HelpCircle size={24} />,  Headphones: <Headphones size={24} />,  Shield: <Shield size={24} />,  PhoneOff: <PhoneOff size={24} />,  Database: <Database size={24} />,  Mail: <Mail size={24} />,  MessageSquare: <MessageSquare size={24} />,  Function: <Function size={24} />,  Music: <Music size={24} />,  Eraser: <Eraser size={24} />,  ArrowRight: <ArrowRight size={24} />,  Tag: <Tag size={24} />,  Clock: <Clock size={24} />,  ServerCog: <ServerCog size={24} />
};

const DEFAULT_LANG = 'it';

const stepBg: Record<string, string> = {
  normal: '#fff',
  noMatch: '#ffeaea',
  noInput: '#f5f6fa',
};
const stepIndent: Record<string, number> = {
  normal: 0,
  noMatch: 24,
  noInput: 24,
};

interface ResponseEditorProps {
  ddt?: any;
  translations?: any;
  lang?: string;
  onClose?: () => void;
}

// Rimuovo defaultNodes

// Inserisce un nodo nell'array subito prima o dopo il targetId, mantenendo parentId e level
function nodesReducer(state: TreeNodeProps[], action: any): TreeNodeProps[] {
  switch (action.type) {
    case 'SET':
      return action.nodes;
    case 'ADD':
      if (action.insertAt) {
        // Inserimento ordinato tra fratelli
        return insertNodeAt(state, action.node, action.targetId, action.position);
      }
      return [...state, action.node];
    case 'REMOVE':
      return state.filter(n => n.id !== action.id);
    default:
      return state;
  }
}

const ResponseEditor: React.FC<ResponseEditorProps> = ({ ddt, translations, lang = 'it', onClose }) => {
  // LOG: stampa le props ricevute
  // LOG: oggetto translations appena ricevuto
  if (translations) {
    const tObj = translations as Record<string, any>;
  } else {
    // LOG: translations è undefined o null!
  }
  type EditorState = {
    selectedStep: string | null;
    actionCatalog: any[];
    showLabel: boolean;
    activeDragAction: any;
    nodes: TreeNodeProps[];
  };

  type EditorAction =
    | { type: 'SET_STEP'; step: string }
    | { type: 'SET_ACTION_CATALOG'; catalog: any[] }
    | { type: 'SET_SHOW_LABEL'; show: boolean }
    | { type: 'SET_ACTIVE_DRAG_ACTION'; action: any }
    | { type: 'SET_NODES'; nodes: TreeNodeProps[] }
    | { type: 'ADD_NODE'; node: TreeNodeProps }
    | { type: 'REMOVE_NODE'; id: string }
    | { type: 'ADD_ESCALATION' }
    | { type: 'SET_ALL_STATE'; state: EditorState }
    | { type: 'TOGGLE_ESCALATION_INCLUDE'; id: string; included: boolean }
    ;

  const initialEditorState: EditorState = {
    selectedStep: null,
    actionCatalog: [],
    showLabel: false,
    activeDragAction: null,
    nodes: [],
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
        return { ...state, nodes: addNode(state.nodes, action.node) };
      case 'REMOVE_NODE': {
        if (typeof action.id !== 'string') {
          console.error('[REMOVE_NODE] id non è una stringa:', action.id);
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
            text: 'recovery', // la label visuale è calcolata a runtime
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

  const [editorState, dispatch] = useReducer(editorReducer, initialEditorState);
  const stepKeys = ddt && ddt.steps ? Object.keys(ddt.steps) : [];
  // --- HISTORY/UNDO/REDO ---
  const historyRef = useRef<EditorState[]>([initialEditorState]);
  const indexRef = useRef(0);
  const [_, forceUpdate] = React.useReducer(x => x + 1, 0); // forzare il rerender su undo/redo

  // Wrapper per dispatch che aggiorna la history
  const dispatchWithHistory = useCallback((action: EditorAction) => {
    // Calcola il nuovo stato
    const newState = editorReducer(editorState, action);
    // Se lo stato è cambiato, aggiorna la history
    if (JSON.stringify(newState) !== JSON.stringify(editorState)) {
      // Tronca la history se siamo in mezzo
      const newHistory = historyRef.current.slice(0, indexRef.current + 1);
      newHistory.push(newState);
      historyRef.current = newHistory;
      indexRef.current = newHistory.length - 1;
      forceUpdate();
    }
    // Applica il dispatch normale
    dispatch(action);
  }, [editorState]);

  // Undo
  const canUndo = indexRef.current > 0;
  const handleUndo = () => {
    if (canUndo) {
      indexRef.current -= 1;
      const prevState = historyRef.current[indexRef.current];
      dispatch({ type: 'SET_ALL_STATE', state: prevState });
      forceUpdate();
    }
  };
  // Redo
  const canRedo = indexRef.current < historyRef.current.length - 1;
  const handleRedo = () => {
    if (canRedo) {
      indexRef.current += 1;
      const nextState = historyRef.current[indexRef.current];
      dispatch({ type: 'SET_ALL_STATE', state: nextState });
      forceUpdate();
    }
  };

  // NOTA: dispatchWithHistory NON va tra le dipendenze per evitare loop infinito
  React.useEffect(() => {
    if (stepKeys.length > 0 && !editorState.selectedStep) {
      dispatchWithHistory({ type: 'SET_STEP', step: stepKeys[0] });
    }
  }, [stepKeys, editorState.selectedStep]);

  // NOTA: dispatchWithHistory NON va tra le dipendenze per evitare loop infinito
  React.useEffect(() => {
    fetch('/data/actionsCatalog.json')
      .then(res => res.json())
      .then(data => dispatchWithHistory({ type: 'SET_ACTION_CATALOG', catalog: data }));
  }, []);

  // Stato nodi dinamico dal DDT
  // NOTA: dispatchWithHistory NON va tra le dipendenze per evitare loop infinito
  useEffect(() => {
    const estratti = estraiNodiDaDDT(ddt, translations, lang);
    // Logga i nodi root per ogni step
    const rootByStep: Record<string, any[]> = {};
    estratti.forEach((n: any) => {
      if ((n.parentId === undefined || n.parentId === null || n.parentId === '') && n.type !== 'escalation') {
        if (!rootByStep[n.type]) rootByStep[n.type] = [];
        rootByStep[n.type].push(n);
      }
    });
    Object.entries(rootByStep).forEach(([step, nodes]) => {
      const arr = nodes as any[];
    });
    dispatchWithHistory({ type: 'SET_NODES', nodes: estratti });
  }, [ddt, translations, lang]);

  // Filtro i nodi per lo step selezionato
  let filteredNodes: TreeNodeProps[] = [];
  if (editorState.selectedStep) {
    // Step con escalation
    const escalationSteps = ['noMatch', 'noInput', 'confirmation', 'notAcquired'];
    if (escalationSteps.includes(editorState.selectedStep)) {
      // Prendi tutti i nodi escalation di questo step e i loro figli
      const escalationNodes = editorState.nodes.filter(n => n.type === 'escalation' && n.id.startsWith(`${editorState.selectedStep}_escalation_`));
      const escalationIds = escalationNodes.map(n => n.id);
      const childNodes = editorState.nodes.filter(n => n.parentId && escalationIds.includes(n.parentId));
      filteredNodes = [...escalationNodes, ...childNodes];
    } else {
      // Step senza escalation: prendi tutte le azioni di questo step che NON sono escalation e NON hanno parentId (root)
      filteredNodes = editorState.nodes.filter(
        n => n.type === editorState.selectedStep && n.type !== 'escalation' && (n.parentId === undefined || n.parentId === null || n.parentId === '')
      );
    }
  }
  // LOG: filteredNodes dopo il filtro per la tab corrente
  if (filteredNodes.length > 0) {
    filteredNodes.forEach(n => {
    });
  }

  // handleDrop logica semplificata (solo aggiunta root per demo)
  const handleDrop = (targetId: string | null, position: 'before' | 'after' | 'child', item: any) => {
    if (item && item.action) {
      const action = item.action;
      const id = Math.random().toString(36).substr(2, 9);
      const newNode: TreeNodeProps = {
        id,
        text: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
        type: 'action',
        icon: item.icon,
        color: item.color,
        label: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
        primaryValue: item.primaryValue,
        parameters: item.parameters,
      };
      if (targetId === null) {
        dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: 0, parentId: undefined } });
      } else {
        const targetNode = editorState.nodes.find(n => n.id === targetId);
        if (!targetNode) {
          dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: 0, parentId: undefined } });
        } else if (targetNode.type === 'escalation' && position === 'child') {
          dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: (targetNode.level || 0) + 1, parentId: targetNode.id } });
        } else if (targetNode.type === 'escalation' && (position === 'before' || position === 'after')) {
          const inserted = insertNodeAt(editorState.nodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, position);
          dispatchWithHistory({ type: 'SET_NODES', nodes: inserted });
        } else if (targetNode.type === 'action') {
          const pos: 'before' | 'after' = position === 'before' ? 'before' : 'after';
          const inserted = insertNodeAt(editorState.nodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, pos);
          dispatchWithHistory({ type: 'SET_NODES', nodes: inserted });
        } else {
          dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: 0, parentId: undefined } });
        }
      }
      setTimeout(() => {}, 100);
      return id;
    }
    // Spostamento nodo esistente: da implementare se serve
    return null;
  };
  const removeNode = (id: string) => {
    if (typeof id !== 'string') {
      console.error('[removeNode] id non è una stringa:', id, 'typeof:', typeof id);
      return;
    }
    dispatchWithHistory({ type: 'REMOVE_NODE', id });
  };

  // Funzione per aggiungere escalation nello step corrente
  const handleAddEscalation = () => {
    dispatchWithHistory({ type: 'ADD_ESCALATION' });
  };

  // Header DDT con icona e label
  const getDDTIcon = (type: string) => {
    if (!type) return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
    const t = type.toLowerCase();
    if (t === 'date') return <Calendar className="w-5 h-5 text-fuchsia-100 mr-2" />;
    if (t === 'email') return <Mail className="w-5 h-5 text-fuchsia-100 mr-2" />;
    if (t === 'address') return <MapPin className="w-5 h-5 text-fuchsia-100 mr-2" />;
    return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
  };

  // Mapping step -> icona, colore, label user-friendly
  const stepMeta: Record<string, { icon: JSX.Element; label: string; border: string; bg: string; color: string; bgActive: string }> = {
    start:        { icon: <PlayCircle size={17} />,        label: 'Chiede il dato',      border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', color: '#3b82f6', bgActive: 'rgba(59,130,246,0.18)' },
    noMatch:      { icon: <HelpCircle size={17} />,        label: 'Non ha capito',       border: '#ef4444', bg: 'rgba(239,68,68,0.08)', color: '#ef4444', bgActive: 'rgba(239,68,68,0.18)' },
    noInput:      { icon: <MicOff size={17} />,            label: 'Non ha sentito',      border: '#6b7280', bg: 'rgba(107,114,128,0.08)', color: '#6b7280', bgActive: 'rgba(107,114,128,0.18)' },
    confirmation: { icon: <CheckCircle2 size={17} />,      label: 'Deve confermare',     border: '#eab308', bg: 'rgba(234,179,8,0.08)', color: '#eab308', bgActive: 'rgba(234,179,8,0.18)' },
    success:      { icon: <CheckSquare size={17} />,       label: 'Ha capito!',          border: '#22c55e', bg: 'rgba(34,197,94,0.08)', color: '#22c55e', bgActive: 'rgba(34,197,94,0.18)' },
    notAcquired:  { icon: <AlertCircle size={17} />,       label: 'Dato non acquisito',  border: '#f59e42', bg: 'rgba(245,158,66,0.08)', color: '#f59e42', bgActive: 'rgba(245,158,66,0.18)' },
  };

  // Funzioni di callback per la UI presentational
  const onStepChange = (step: string) => dispatchWithHistory({ type: 'SET_STEP', step });
  const onShowLabelChange = (show: boolean) => dispatchWithHistory({ type: 'SET_SHOW_LABEL', show });

  // Props per la UI
  const ddtType = ddt?.dataType?.type;
  const ddtLabel = ddt?.label || ddt?.name || '—';

  // Estendi editorState con funzioni per la UI
  const editorStateForUI = {
    ...editorState,
    ddtType,
    ddtLabel,
    onStepChange,
    onShowLabelChange,
  };

  // Funzione per toggle
  const handleToggleInclude = (id: string, included: boolean) => {
    dispatchWithHistory({ type: 'TOGGLE_ESCALATION_INCLUDE', id, included });
  };

  return (
    <ResponseEditorUI
      editorState={editorStateForUI}
      filteredNodes={filteredNodes}
      stepKeys={stepKeys}
      stepMeta={stepMeta}
      handleDrop={handleDrop}
      removeNode={removeNode}
      handleAddEscalation={handleAddEscalation}
      handleUndo={handleUndo}
      handleRedo={handleRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      getDDTIcon={getDDTIcon}
      onClose={onClose || (() => {})}
      onToggleInclude={handleToggleInclude}
    />
  );
};

export default ResponseEditor;