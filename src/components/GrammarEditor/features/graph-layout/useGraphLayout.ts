// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../../core/state/grammarStoreContext';
import { horizontalLayout, hierarchicalLayout } from './layoutAlgorithms';
import type { Grammar } from '../../types/grammarTypes';

/**
 * Hook for handling graph layout
 */
export function useGraphLayout() {
  const { grammar, updateNode } = useGrammarStore();

  const applyHorizontalLayout = useCallback(() => {
    if (!grammar) return;

    const updatedNodes = horizontalLayout(grammar.nodes);
    updatedNodes.forEach(node => {
      updateNode(node.id, { position: node.position });
    });
  }, [grammar, updateNode]);

  const applyHierarchicalLayout = useCallback(() => {
    if (!grammar) return;

    const updatedNodes = hierarchicalLayout(grammar);
    updatedNodes.forEach(node => {
      updateNode(node.id, { position: node.position });
    });
  }, [grammar, updateNode]);

  return {
    applyHorizontalLayout,
    applyHierarchicalLayout,
  };
}
