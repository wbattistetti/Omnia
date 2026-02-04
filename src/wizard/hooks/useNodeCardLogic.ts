// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useNodeCardLogic Hook
 *
 * Extracts all business logic from NodeCard component.
 * NodeCard becomes a pure presentation component.
 */

import { useState, useCallback, useMemo } from 'react';
import type { SchemaNode } from '../types/wizard.types';
import { updateNodeLabel, addSubNode, removeSubNode } from '../state/nodeState';

export interface UseNodeCardLogicOptions {
  node: SchemaNode;
  nodeId: string;
  onNodeChange?: (nodeId: string, node: SchemaNode) => void;
  onAddSubNode?: (parentNodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}

export interface UseNodeCardLogicReturn {
  // Label editing
  isEditingLabel: boolean;
  labelDraft: string;
  startEditingLabel: () => void;
  commitLabel: () => void;
  cancelLabel: () => void;
  setLabelDraft: (label: string) => void;

  // Sub-nodes
  allSubNodes: SchemaNode[];
  hasSubNodes: boolean;
  handleAddSub: () => void;
  handleDelete: () => void;
  handleSubNodeChange: (subNodeId: string, subNode: SchemaNode) => void;
}

/**
 * Hook that manages all NodeCard business logic
 */
export function useNodeCardLogic({
  node,
  nodeId,
  onNodeChange,
  onAddSubNode,
  onDeleteNode
}: UseNodeCardLogicOptions): UseNodeCardLogicReturn {
  // Label editing state
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(node.label);

  // Compute sub-nodes
  const { allSubNodes, hasSubNodes } = useMemo(() => {
    const subData = node.subData || [];
    const subTasks = node.subTasks || [];
    const all = subTasks.length > 0 ? subTasks : subData;
    return {
      allSubNodes: all,
      hasSubNodes: all.length > 0
    };
  }, [node.subData, node.subTasks]);

  // Label editing handlers
  const startEditingLabel = useCallback(() => {
    setLabelDraft(node.label);
    setIsEditingLabel(true);
  }, [node.label]);

  const commitLabel = useCallback(() => {
    if (labelDraft.trim() && labelDraft !== node.label) {
      const updated = updateNodeLabel(node, labelDraft.trim());
      onNodeChange?.(nodeId, updated);
    }
    setIsEditingLabel(false);
  }, [node, nodeId, labelDraft, onNodeChange]);

  const cancelLabel = useCallback(() => {
    setLabelDraft(node.label);
    setIsEditingLabel(false);
  }, [node.label]);

  // Sub-node handlers
  const handleAddSub = useCallback(() => {
    const newSubNode: SchemaNode = {
      id: `sub-${nodeId}-${Date.now()}`,
      label: 'New sub-node',
      type: node.type,
      mode: node.mode === 'ai' ? 'ai' : undefined // Propagate AI mode
    };

    const updated = addSubNode(node, newSubNode);
    onNodeChange?.(nodeId, updated);
    onAddSubNode?.(nodeId);
  }, [node, nodeId, onNodeChange, onAddSubNode]);

  const handleDelete = useCallback(() => {
    if (window.confirm(`Delete node "${node.label}"?`)) {
      onDeleteNode?.(nodeId);
    }
  }, [node.label, nodeId, onDeleteNode]);

  const handleSubNodeChange = useCallback((subNodeId: string, subNode: SchemaNode) => {
    const index = allSubNodes.findIndex(n => n.id === subNodeId);
    if (index === -1) return;

    const updatedSubNodes = [...allSubNodes];
    updatedSubNodes[index] = subNode;

    const subData = node.subData || [];
    const subTasks = node.subTasks || [];
    const updated = {
      ...node,
      subData: subTasks.length > 0 ? undefined : updatedSubNodes,
      subTasks: subTasks.length > 0 ? updatedSubNodes : undefined
    };

    onNodeChange?.(nodeId, updated);
  }, [node, nodeId, allSubNodes, onNodeChange]);

  return {
    // Label editing
    isEditingLabel,
    labelDraft,
    startEditingLabel,
    commitLabel,
    cancelLabel,
    setLabelDraft,

    // Sub-nodes
    allSubNodes,
    hasSubNodes,
    handleAddSub,
    handleDelete,
    handleSubNodeChange
  };
}
