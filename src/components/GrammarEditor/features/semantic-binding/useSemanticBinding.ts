// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../../core/state/grammarStoreContext';
import { addBinding } from '../../core/domain/node';
import type { NodeBinding } from '../../types/grammarTypes';

/**
 * Hook for handling drag & drop semantic → node
 */
export function useSemanticBinding() {
  const { updateNode, getNode } = useGrammarStore();

  const bindValueToNode = useCallback((
    nodeId: string,
    valueId: string
  ) => {
    const node = getNode(nodeId);
    if (!node) return { success: false, error: 'Node not found' };

    const binding: NodeBinding = { type: 'semantic-value', valueId };
    const result = addBinding(node, binding);
    if (result.isValid) {
      updateNode(nodeId, result.node);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, [getNode, updateNode]);

  const bindSetToNode = useCallback((
    nodeId: string,
    setId: string
  ) => {
    const node = getNode(nodeId);
    if (!node) return { success: false, error: 'Node not found' };

    const binding: NodeBinding = { type: 'semantic-set', setId };
    const result = addBinding(node, binding);
    if (result.isValid) {
      updateNode(nodeId, result.node);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, [getNode, updateNode]);

  const bindSlotToNode = useCallback((
    nodeId: string,
    slotId: string
  ) => {
    const node = getNode(nodeId);
    if (!node) return { success: false, error: 'Node not found' };

    const binding: NodeBinding = { type: 'slot', slotId };
    const result = addBinding(node, binding);
    if (result.isValid) {
      updateNode(nodeId, result.node);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, [getNode, updateNode]);

  return {
    bindValueToNode,
    bindSetToNode,
    bindSlotToNode,
  };
}
