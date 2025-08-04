import { useCallback } from 'react';
import { EditorAction } from './useDDTEditorState';
import { handleDropWithInsert } from './useHandleDrop';

// Hook per le azioni dell'editor
export function useEditorActions(
  dispatch: React.Dispatch<EditorAction>,
  state: {
    nodes: any[];
    selectedStep: string;
    showLabel: boolean;
  }
) {
  // Actions
  const setStep = useCallback((step: string) => {
    dispatch({ type: 'SET_STEP', step });
  }, [dispatch]);

  const setSelectedNodeIndex = useCallback((index: number | null) => {
    dispatch({ type: 'SET_SELECTED_NODE_INDEX', index });
  }, [dispatch]);

  const setActionCatalog = useCallback((catalog: any[]) => {
    dispatch({ type: 'SET_ACTION_CATALOG', catalog });
  }, [dispatch]);

  // Nuovo: funzione per rimuovere nodi
  const removeNode = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NODE', id });
  }, [dispatch]);

  // ✅ NUOVO: funzione toggleShowLabel
  const toggleShowLabel = useCallback(() => {
    dispatch({ type: 'SET_SHOW_LABEL', value: !state.showLabel });
  }, [dispatch, state.showLabel]);

  // ✅ NUOVO: funzione per aggiungere escalation
  const addEscalation = useCallback(() => {
    dispatch({ type: 'ADD_ESCALATION' });
  }, [dispatch]);

  // ✅ NUOVO: funzione per gestire il drop
  const handleDrop = useCallback((targetId: string | null, position: 'before' | 'after' | 'child', item: any) => {
    handleDropWithInsert({
      editorNodes: state.nodes,
      targetId,
      position,
      item,
      selectedStep: state.selectedStep,
      dispatch
    });
  }, [state.nodes, state.selectedStep, dispatch]);

  return {
    setStep,
    setSelectedNodeIndex,
    setActionCatalog,
    removeNode,
    toggleShowLabel,
    addEscalation,
    handleDrop
  };
} 