// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node State Management
 *
 * Pure functions for managing node state.
 * No side effects, no React dependencies.
 */

import type { SchemaNode, NodeState, NodeMode } from '../types/wizard.types';

/**
 * Create initial node state
 */
export function createNodeState(node: SchemaNode): NodeState {
  if (node.state) {
    return node.state;
  }
  return 'proposed';
}

/**
 * Set node mode
 */
export function setNodeMode(node: SchemaNode, mode: NodeMode): SchemaNode {
  return {
    ...node,
    mode
  };
}

/**
 * Set node state
 */
export function setNodeState(node: SchemaNode, state: NodeState): SchemaNode {
  return {
    ...node,
    state
  };
}

/**
 * Update node label
 */
export function updateNodeLabel(node: SchemaNode, label: string): SchemaNode {
  return {
    ...node,
    label
  };
}

/**
 * Add sub-node
 */
export function addSubNode(node: SchemaNode, subNode: SchemaNode): SchemaNode {
  const subData = node.subData || [];
  const subTasks = node.subTasks || [];

  // Add to subData by default (legacy support)
  return {
    ...node,
    subData: [...subData, subNode],
    subTasks: subTasks.length > 0 ? [...subTasks, subNode] : undefined
  };
}

/**
 * Remove sub-node by index
 */
export function removeSubNode(node: SchemaNode, index: number): SchemaNode {
  const subData = node.subData || [];
  const subTasks = node.subTasks || [];

  if (subTasks.length > 0) {
    return {
      ...node,
      subTasks: subTasks.filter((_, i) => i !== index)
    };
  }

  return {
    ...node,
    subData: subData.filter((_, i) => i !== index)
  };
}

/**
 * Update sub-node by index
 */
export function updateSubNode(node: SchemaNode, index: number, subNode: SchemaNode): SchemaNode {
  const subData = node.subData || [];
  const subTasks = node.subTasks || [];

  if (subTasks.length > 0) {
    const newSubTasks = [...subTasks];
    newSubTasks[index] = subNode;
    return {
      ...node,
      subTasks: newSubTasks
    };
  }

  const newSubData = [...subData];
  newSubData[index] = subNode;
  return {
    ...node,
    subData: newSubData
  };
}

/**
 * Check if node has sub-nodes
 */
export function hasSubNodes(node: SchemaNode): boolean {
  const subData = node.subData || [];
  const subTasks = node.subTasks || [];
  return subData.length > 0 || subTasks.length > 0;
}

/**
 * Get all sub-nodes (from subData or subTasks)
 */
export function getAllSubNodes(node: SchemaNode): SchemaNode[] {
  const subData = node.subData || [];
  const subTasks = node.subTasks || [];
  return subTasks.length > 0 ? subTasks : subData;
}
