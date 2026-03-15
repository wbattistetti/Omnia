// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../core/state/grammarStore';
import { useNodeCreation } from '../features/node-creation/useNodeCreation';

/**
 * Hook for handling node interactions
 * - Click, double click, drag, context menu
 */
export function useNodeInteractions() {
  const { selectNode, deleteNode, updateNode, getNode } = useGrammarStore();
  const { createNodeAfter } = useNodeCreation();

  const handleNodeClick = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    // Create new node after this one
    createNodeAfter(nodeId);
  }, [createNodeAfter]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    deleteNode(nodeId);
  }, [deleteNode]);

  const handleNodeDrag = useCallback((nodeId: string, position: { x: number; y: number }) => {
    updateNode(nodeId, { position });
  }, [updateNode]);

  return {
    handleNodeClick,
    handleNodeDoubleClick,
    handleNodeDelete,
    handleNodeDrag,
  };
}
