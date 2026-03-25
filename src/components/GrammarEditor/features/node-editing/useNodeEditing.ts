// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../../core/state/grammarStore';
import {
  updateNodeLabel,
  addSynonym,
  removeSynonym,
  updateNodeRegex,
  addBinding,
  removeBinding,
  clearBindings,
  setNodeOptional,
  setNodeRepeatable,
} from '../../core/domain/node';
import type { NodeBinding } from '../../types/grammarTypes';

/**
 * Hook for handling node editing
 */
export function useNodeEditing() {
  const { updateNode, getNode } = useGrammarStore();

  const editNodeLabel = useCallback((nodeId: string, label: string) => {
    const node = getNode(nodeId);
    if (!node) return { success: false as const, error: 'Node not found' };
    const result = updateNodeLabel(node, label);
    if (!result.isValid) {
      return { success: false as const, error: result.error ?? 'Invalid label' };
    }
    updateNode(nodeId, result.node);
    return { success: true as const };
  }, [getNode, updateNode]);

  const addNodeSynonym = useCallback((nodeId: string, synonym: string) => {
    const node = getNode(nodeId);
    if (!node) return { success: false as const, error: 'Node not found' };
    const result = addSynonym(node, synonym);
    if (!result.isValid) {
      return { success: false as const, error: result.error ?? 'Cannot add synonym' };
    }
    updateNode(nodeId, result.node);
    return { success: true as const };
  }, [getNode, updateNode]);

  const removeNodeSynonym = useCallback((nodeId: string, synonym: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    const updated = removeSynonym(node, synonym);
    updateNode(nodeId, updated);
  }, [getNode, updateNode]);

  const editNodeRegex = useCallback((nodeId: string, regex: string | undefined) => {
    const node = getNode(nodeId);
    if (!node) return;
    const updated = updateNodeRegex(node, regex);
    updateNode(nodeId, updated);
  }, [getNode, updateNode]);

  const addNodeBinding = useCallback((
    nodeId: string,
    binding: NodeBinding
  ) => {
    const node = getNode(nodeId);
    if (!node) return { success: false, error: 'Node not found' };
    const result = addBinding(node, binding);
    if (result.isValid) {
      updateNode(nodeId, result.node);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, [getNode, updateNode]);

  const removeNodeBinding = useCallback((
    nodeId: string,
    bindingType: NodeBinding['type'],
    id: string
  ) => {
    const node = getNode(nodeId);
    if (!node) return;
    const updated = removeBinding(node, bindingType, id);
    updateNode(nodeId, updated);
  }, [getNode, updateNode]);

  const clearNodeBindings = useCallback((nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    const updated = clearBindings(node);
    updateNode(nodeId, updated);
  }, [getNode, updateNode]);

  const setOptional = useCallback((nodeId: string, optional: boolean) => {
    const node = getNode(nodeId);
    if (!node) return;
    const updated = setNodeOptional(node, optional);
    updateNode(nodeId, updated);
  }, [getNode, updateNode]);

  const setRepeatable = useCallback((nodeId: string, repeatable: boolean) => {
    const node = getNode(nodeId);
    if (!node) return;
    const updated = setNodeRepeatable(node, repeatable);
    updateNode(nodeId, updated);
  }, [getNode, updateNode]);

  return {
    editNodeLabel,
    addNodeSynonym,
    removeNodeSynonym,
    editNodeRegex,
    addNodeBinding,
    removeNodeBinding,
    clearNodeBindings,
    setOptional,
    setRepeatable,
  };
}
