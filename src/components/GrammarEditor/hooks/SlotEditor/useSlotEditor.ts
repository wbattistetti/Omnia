// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';
import { useGrammarStore } from '../../core/state/grammarStoreContext';
import { useUndoRedo } from './useUndoRedo';
import { useSlotEditorActions } from './useSlotEditorActions';
import { buildTreeStructure } from '../../core/domain/slotEditor';
import type { TreeNode } from '../../types/slotEditorTypes';

/**
 * Main hook for Slot Editor
 * Single Responsibility: Orchestrates all slot editor functionality
 */
export function useSlotEditor(editorMode: 'text' | 'graph' = 'text') {
  const { grammar } = useGrammarStore();
  const { recordOperation, undo, redo, canUndo, canRedo, clear: clearUndoRedo } = useUndoRedo();
  const actions = useSlotEditorActions(recordOperation);

  // Build tree structure (alphabetically sorted)
  const tree = useMemo<TreeNode[]>(() => {
    if (!grammar) return [];
    return buildTreeStructure(grammar.slots, grammar.semanticSets);
  }, [grammar?.slots, grammar?.semanticSets]);

  // Theme colors based on editor mode
  const theme = useMemo(
    () => ({
      background: editorMode === 'graph' ? '#121621' : '#ffffff',
      border: editorMode === 'graph' ? '#252a3e' : '#e5e7eb',
      text: editorMode === 'graph' ? '#e5e7eb' : '#000000',
      itemBackground: editorMode === 'graph' ? 'rgba(156,163,175,0.25)' : '#fff',
      itemBorder: editorMode === 'graph' ? '#334155' : '#d1d5db',
      placeholder: editorMode === 'graph' ? '#9ca3af' : '#6b7280',
    }),
    [editorMode]
  );

  return {
    // State
    tree,
    slots: grammar?.slots || [],
    semanticSets: grammar?.semanticSets || [],
    theme,

    // Actions
    ...actions,

    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    clearUndoRedo,
  };
}
