import React, { useReducer, useEffect } from 'react';
import { 
  editorReducer, 
  initialState, 
  EditorState 
} from './useDDTEditorState';
import { useEditorActions } from './useDDTEditorActions';
import { useEditorComputed } from './useDDTEditorComputed';

// Hook principale
export function useDDTEditor({ ddt, translations, lang }: {
  ddt: any;
  translations: any;
  lang: string;
}) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // Calcola i valori derivati
  const computed = useEditorComputed(
    ddt,
    translations,
    lang,
    state.selectedNodeIndex,
    state.nodes,
    state.selectedStep
  );

  // Ottiene le azioni
  const actions = useEditorActions(dispatch, {
    nodes: state.nodes,
    selectedStep: state.selectedStep,
    showLabel: state.showLabel
  });

  // Miglioria: useEffect diretto invece di updateNodes separato
  useEffect(() => {
    dispatch({ type: 'SET_NODES', nodes: computed.extractedNodes });
  }, [computed.extractedNodes]);

  return {
    // Stato
    selectedStep: state.selectedStep,
    selectedNodeIndex: state.selectedNodeIndex,
    nodes: state.nodes,
    filteredNodes: computed.filteredNodes,
    selectedNode: computed.selectedNode,
    actionCatalog: state.actionCatalog,
    showLabel: state.showLabel, // ✅ NUOVO: aggiunto showLabel
    
    // Actions
    ...actions,
    
    // Debug
    extractedNodes: computed.extractedNodes
  };
} 