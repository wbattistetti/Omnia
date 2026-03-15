// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../../core/state/grammarStore';
import { bindSemanticValue, bindSemanticSet } from '../../core/domain/node';

/**
 * Hook for handling drag & drop semantic → node
 */
export function useSemanticBinding() {
  const { updateNode, getNode } = useGrammarStore();

  const bindValueToNode = useCallback((
    nodeId: string,
    valueId: string,
    slotId: string
  ) => {
    const node = getNode(nodeId);
    if (!node) return;

    const updated = bindSemanticValue(node, valueId, slotId);
    updateNode(nodeId, updated);
  }, [getNode, updateNode]);

  const bindSetToNode = useCallback((
    nodeId: string,
    setId: string,
    slotId: string
  ) => {
    const node = getNode(nodeId);
    if (!node) return;

    const updated = bindSemanticSet(node, setId, slotId);
    updateNode(nodeId, updated);
  }, [getNode, updateNode]);

  return {
    bindValueToNode,
    bindSetToNode,
  };
}
