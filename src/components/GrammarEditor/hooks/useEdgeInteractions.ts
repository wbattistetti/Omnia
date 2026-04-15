// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../core/state/grammarStoreContext';
import { generateSafeGuid } from '@utils/idGenerator';
import type { GrammarEdge } from '../types/grammarTypes';

/**
 * Hook for handling edge interactions
 * - Click, delete, edit
 */
export function useEdgeInteractions() {
  const { selectEdge, deleteEdge, updateEdge, addEdge } = useGrammarStore();

  const handleEdgeClick = useCallback((edgeId: string) => {
    selectEdge(edgeId);
  }, [selectEdge]);

  const handleEdgeDelete = useCallback((edgeId: string) => {
    deleteEdge(edgeId);
  }, [deleteEdge]);

  const handleEdgeCreate = useCallback((
    source: string,
    target: string,
    type: GrammarEdge['type'] = 'sequential'
  ) => {
    const newEdge: GrammarEdge = {
      id: generateSafeGuid(),
      source,
      target,
      type,
    };
    addEdge(newEdge);
    return newEdge;
  }, [addEdge]);

  return {
    handleEdgeClick,
    handleEdgeDelete,
    handleEdgeCreate,
  };
}
