// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../../core/state/grammarStore';
import {
  updateNodeLabel,
  addSynonym,
  removeSynonym,
  updateNodeRegex,
  bindSemanticValue,
  bindSemanticSet,
  unbindSemantic,
  setNodeOptional,
  setNodeRepeatable,
} from '../../core/domain/node';

/**
 * Hook for handling node editing
 */
export function useNodeEditing() {
  const { updateNode, getNode } = useGrammarStore();

  const editNodeLabel = useCallback((nodeId: string, label: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    const updated = updateNodeLabel(node, label);
    updateNode(nodeId, updated);
  }, [getNode, updateNode]);

  const addNodeSynonym = useCallback((nodeId: string, synonym: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    const updated = addSynonym(node, synonym);
    updateNode(nodeId, updated);
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

  const unbindNodeSemantic = useCallback((nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    const updated = unbindSemantic(node);
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
    bindValueToNode,
    bindSetToNode,
    unbindNodeSemantic,
    setOptional,
    setRepeatable,
  };
}
