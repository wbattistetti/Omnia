// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useNodeEditing Hook
 *
 * Manages editing state for a single node.
 * Handles label editing, sub-node management, and validation.
 */

import { useState, useCallback } from 'react';
import type { SchemaNode } from '../types/wizard.types';
import {
  updateNodeLabel,
  addSubNode,
  removeSubNode,
  updateSubNode
} from '../state/nodeState';

export function useNodeEditing(
  node: SchemaNode,
  onNodeChange: (node: SchemaNode) => void
) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(node.label);

  const startEditingLabel = useCallback(() => {
    setLabelDraft(node.label);
    setIsEditingLabel(true);
  }, [node.label]);

  const commitLabel = useCallback(() => {
    if (labelDraft.trim() && labelDraft !== node.label) {
      const updated = updateNodeLabel(node, labelDraft.trim());
      onNodeChange(updated);
    }
    setIsEditingLabel(false);
  }, [node, labelDraft, onNodeChange]);

  const cancelLabel = useCallback(() => {
    setLabelDraft(node.label);
    setIsEditingLabel(false);
  }, [node.label]);

  const addSub = useCallback((subNode: SchemaNode) => {
    const updated = addSubNode(node, subNode);
    onNodeChange(updated);
  }, [node, onNodeChange]);

  const removeSub = useCallback((index: number) => {
    const updated = removeSubNode(node, index);
    onNodeChange(updated);
  }, [node, onNodeChange]);

  const updateSub = useCallback((index: number, subNode: SchemaNode) => {
    const updated = updateSubNode(node, index, subNode);
    onNodeChange(updated);
  }, [node, onNodeChange]);

  return {
    isEditingLabel,
    labelDraft,
    setLabelDraft,
    startEditingLabel,
    commitLabel,
    cancelLabel,
    addSub,
    removeSub,
    updateSub
  };
}
