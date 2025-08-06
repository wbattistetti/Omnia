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
import React, { useEffect } from 'react';
import ResponseEditorUI from './ResponseEditorUI';
import ActionItem from '../ActionViewer/ActionItem';
import ActionList from '../ActionViewer/ActionList';
import { Tag, MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Clock, ServerCog, Calendar, MapPin, FileText, PlayCircle, MicOff, CheckCircle2, CheckSquare, AlertCircle, Plus } from 'lucide-react';
import ToolbarButton from './ToolbarButton';
import TreeView from './TreeView';
import ResponseEditorToolbar from './ResponseEditorToolbar';
import ResponseEditorSidebar from './ResponseEditorSidebar';
import styles from './ResponseEditor.module.css';
import { TreeNodeProps } from './types';
import { useTreeNodes } from './useTreeNodes';
import { useRef, useCallback } from 'react';
import { estraiNodiDaDDT, insertNodeAt, removeNodePure, addNode } from './treeFactories';
import { estraiParametroPrincipale, estraiValoreTradotto, getTranslationText, ordinalIt, estraiLabelAzione } from './responseEditorHelpers';
import { v4 as uuidv4 } from 'uuid';
import { createAction } from './actionFactories';
import { createParameter } from './parameterFactories';
import { useResponseEditorState } from './useResponseEditorState';

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

const ResponseEditor: React.FC<ResponseEditorProps> = ({ ddt, translations, lang = 'it', onClose }) => {
  const {
    state,
    dispatch,
    canUndo,
    canRedo,
    undo,
    redo
  } = useResponseEditorState();

  const { selectedStep, actionCatalog, showLabel, activeDragAction, nodes } = state;

  const stepKeys = ddt && ddt.steps ? Object.keys(ddt.steps) : [];
  // --- HISTORY/UNDO/REDO ---
  const historyRef = useRef<any[]>([]); // Changed to any[] as per new state structure
  const indexRef = useRef(0);
  const [_, forceUpdate] = React.useReducer(x => x + 1, 0); // forzare il rerender su undo/redo

  // Wrapper per dispatch che aggiorna la history
  const dispatchWithHistory = useCallback((action: any) => { // Changed to any as per new state structure
    // Calcola il nuovo stato
    const newState = action; // Simplified as per new state structure
    // Se lo stato è cambiato, aggiorna la history
    if (JSON.stringify(newState) !== JSON.stringify(state)) { // Changed to state
      // Tronca la history se siamo in mezzo
      const newHistory = historyRef.current.slice(0, indexRef.current + 1);
      newHistory.push(state); // Changed to state
      historyRef.current = newHistory;
      indexRef.current = newHistory.length - 1;

      // Limita la history a 50 stati
      if (historyRef.current.length > 50) {
        historyRef.current = historyRef.current.slice(-50);
        indexRef.current = historyRef.current.length - 1;
      }
    }
    // Applica il dispatch normale
    dispatch(action);
  }, [state]); // Changed to state

  // NOTA: dispatchWithHistory NON va tra le dipendenze per evitare loop infinito
  React.useEffect(() => {
    // Seleziona automaticamente il primo step solo quando si apre il Response Editor per la prima volta
    // (quando non c'è uno step selezionato E ci sono stepKeys disponibili)
    if (stepKeys.length > 0 && !selectedStep) {
      dispatchWithHistory({ type: 'SET_STEP', step: stepKeys[0] });
    }
  }, [stepKeys, selectedStep]);

  // NOTA: dispatchWithHistory NON va tra le dipendenze per evitare loop infinito
  React.useEffect(() => {
    fetch('/data/actionsCatalog.json')
      .then(res => res.json())
      .then(data => dispatchWithHistory({ type: 'SET_ACTION_CATALOG', catalog: data }));
  }, []);

  // Stato nodi dinamico dal DDT
  // NOTA: dispatchWithHistory NON va tra le dipendenze per evitare loop infinito
  useEffect(() => {
    const estratti = estraiNodiDaDDT(ddt?.mainData, translations, lang);
    dispatchWithHistory({ type: 'SET_NODES', nodes: estratti });
  }, [ddt, translations, lang]);

  // Filtro i nodi per lo step selezionato
  let filteredNodes: TreeNodeProps[] = [];
  if (selectedStep) {
    // Mostra solo le escalation e le azioni del tipo di step selezionato
    const escalationNodes = nodes.filter(
      n => n.type === 'escalation' && n.stepType === selectedStep
    );
    const escalationIds = escalationNodes.map(n => n.id);
    const childNodes = nodes.filter(
      n => n.parentId && escalationIds.includes(n.parentId)
    );
    filteredNodes = [...escalationNodes, ...childNodes];
  }

  // handleDrop logica semplificata (solo aggiunta root per demo)
  const handleDrop = (targetId: string | null, position: 'before' | 'after' | 'child', item: any) => {
    if (item && item.action) {
      const action = item.action;
      const id = Math.random().toString(36).substr(2, 9);
      const newNode: TreeNodeProps = createAction({
        id,
        text: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
        type: 'action',
        icon: item.icon,
        color: item.color,
        label: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
        primaryValue: item.primaryValue,
        parameters: item.parameters ? item.parameters.map(createParameter) : undefined,
      });
      if (targetId === null) {
        dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: 0, parentId: undefined } });
      } else {
        const targetNode = nodes.find(n => n.id === targetId);
        if (!targetNode) {
          dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: 0, parentId: undefined } });
        } else if (targetNode.type === 'escalation' && position === 'child') {
          dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: (targetNode.level || 0) + 1, parentId: targetNode.id } });
        } else if (targetNode.type === 'escalation' && (position === 'before' || position === 'after')) {
          const inserted = insertNodeAt(nodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, position);
          dispatchWithHistory({ type: 'SET_NODES', nodes: inserted });
        } else if (targetNode.type === 'action') {
          const pos: 'before' | 'after' = position === 'before' ? 'before' : 'after';
          const inserted = insertNodeAt(nodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, pos);
          dispatchWithHistory({ type: 'SET_NODES', nodes: inserted });
        } else {
          dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: 0, parentId: undefined } });
        }
      }
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
    start:        { icon: <PlayCircle size={17} />,        label: 'Chiedo il dato',      border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', color: '#3b82f6', bgActive: 'rgba(59,130,246,0.18)' },
    noMatch:      { icon: <HelpCircle size={17} />,        label: 'Non capisco',         border: '#ef4444', bg: 'rgba(239,68,68,0.08)', color: '#ef4444', bgActive: 'rgba(239,68,68,0.18)' },
    noInput:      { icon: <MicOff size={17} />,            label: 'Non sento',           border: '#6b7280', bg: 'rgba(107,114,128,0.08)', color: '#6b7280', bgActive: 'rgba(107,114,128,0.18)' },
    confirmation: { icon: <CheckCircle2 size={17} />,      label: 'Devo confermare',     border: '#eab308', bg: 'rgba(234,179,8,0.08)', color: '#eab308', bgActive: 'rgba(234,179,8,0.18)' },
    success:      { icon: <CheckSquare size={17} />,       label: 'Ho capito!',           border: '#22c55e', bg: 'rgba(34,197,94,0.08)', color: '#22c55e', bgActive: 'rgba(34,197,94,0.18)' },
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
    ...state,
    ddtType,
    ddtLabel,
    ddt, // <-- aggiungo ddt esplicitamente per log
    onStepChange,
    onShowLabelChange,
  };

  // Funzione per toggle
  const handleToggleInclude = (id: string, included: boolean) => {
    dispatchWithHistory({ type: 'TOGGLE_ESCALATION_INCLUDE', id, included });
  };

  const [selectedNodeIndex, setSelectedNodeIndex] = React.useState<number | null>(null);

  // Funzione per estrarre il nodo selezionato
  function getNodeByIndex(mainData: any, index: any) {
    if (index == null) return mainData;
    if (!mainData.subData || !mainData.subData[index]) return mainData;
    return mainData.subData[index];
  }

  // Costruisci il DDT virtuale per la UI
  const selectedNode = getNodeByIndex(ddt?.mainData || {}, selectedNodeIndex);
  const ddtForUI = ddt ? {
    ...ddt,
    steps: Object.fromEntries(
      (selectedNode?.steps || []).map((stepGroup: any) => [
        stepGroup.type,
        (stepGroup.escalations || []).map((escalation: any) => ({
          type: 'escalation',
          id: escalation.escalationId,
          actions: escalation.actions
        }))
      ])
    )
  } : ddt;

  // Log selectedNodeIndex and selectedNode whenever they change
  useEffect(() => {
    const mainData = ddt?.mainData || {};
    const node = getNodeByIndex(mainData, selectedNodeIndex);
    if (node && node.steps) {
      node.steps.forEach((step: any, idx: any) => {
        if (step.escalations) {
        }
      });
    } else {
    }
  }, [selectedNodeIndex, ddt]);

  useEffect(() => {
    // Get the current node (main or subdata)
    const node = getNodeByIndex(ddt?.mainData || {}, selectedNodeIndex);
    // Extract nodes for this node only
    const estratti = estraiNodiDaDDT(node, translations, lang);
    dispatchWithHistory({ type: 'SET_NODES', nodes: estratti });
  }, [selectedNodeIndex, translations, lang]);

  const handleSelectNode = (index: number | null) => {
    setSelectedNodeIndex(index);
    // NON resettare lo step quando si cambia nodo
    // Mantieni lo step corrente se è disponibile nel nuovo nodo
    const node = getNodeByIndex(ddt?.mainData || {}, index);
    const availableSteps = node?.steps?.map((s: any) => s.type) || [];
    
    // Se lo step corrente non è disponibile nel nuovo nodo, seleziona il primo disponibile
    if (selectedStep && !availableSteps.includes(selectedStep)) {
      if (availableSteps.length > 0) {
        dispatchWithHistory({ type: 'SET_STEP', step: availableSteps[0] });
      } else {
        dispatchWithHistory({ type: 'SET_STEP', step: '' });
      }
    }
    // Se lo step corrente è disponibile, mantienilo (non fare nulla)
  };

  return (
    <ResponseEditorUI
      editorState={editorStateForUI}
      filteredNodes={filteredNodes}
      stepKeys={ddtForUI?.steps ? Object.keys(ddtForUI.steps) : []}
      stepMeta={stepMeta}
      handleDrop={handleDrop}
      removeNode={removeNode}
      handleAddEscalation={handleAddEscalation}
      handleUndo={undo}
      handleRedo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
      getDDTIcon={getDDTIcon}
      onClose={onClose || (() => {})}
      onToggleInclude={handleToggleInclude}
      selectedNodeIndex={selectedNodeIndex}
      onSelectNode={handleSelectNode}
    />
  );
};

export default ResponseEditor;