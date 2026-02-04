// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Mode State Management (Documented)
 *
 * Pure functions for managing node mode (IA/Manual/Postponed).
 * Handles propagation of IA mode to children with documented recursion.
 * No side effects, no React dependencies.
 */

import type { SchemaNode, NodeMode } from '../types/wizard.types';

/**
 * Maximum recursion depth to prevent stack overflow.
 * INVARIANT: Depth must never exceed MAX_RECURSION_DEPTH.
 */
const MAX_RECURSION_DEPTH = 10;

/**
 * Set node mode with propagation to children.
 *
 * RECURSION INVARIANTS:
 * - When mode is 'ai', all children are automatically set to 'ai'
 * - When mode is 'manual' or 'postponed', children are NOT automatically changed
 * - Maximum depth: MAX_RECURSION_DEPTH (prevents stack overflow)
 *
 * @param node - Node to update
 * @param mode - Mode to set ('ai' | 'manual' | 'postponed')
 * @param depth - Current recursion depth (internal, defaults to 0)
 * @returns Updated node with propagated mode
 *
 * @throws Error if recursion depth exceeds MAX_RECURSION_DEPTH
 */
export function setNodeModeWithPropagation(
  node: SchemaNode,
  mode: NodeMode,
  depth: number = 0
): SchemaNode {
  // INVARIANT: Check recursion depth
  if (depth > MAX_RECURSION_DEPTH) {
    throw new Error(
      `Recursion depth exceeded maximum of ${MAX_RECURSION_DEPTH}. ` +
      `This indicates a circular reference or extremely deep tree structure.`
    );
  }

  const updatedNode = {
    ...node,
    mode
  };

  // If mode is 'ai', propagate to all children
  if (mode === 'ai') {
    const subData = node.subData || [];
    const subTasks = node.subTasks || [];
    const allSubNodes = subTasks.length > 0 ? subTasks : subData;

    if (allSubNodes.length > 0) {
      // RECURSIVE CALL: Increment depth
      const updatedSubNodes = allSubNodes.map(subNode =>
        setNodeModeWithPropagation(subNode, 'ai', depth + 1)
      );

      if (subTasks.length > 0) {
        return {
          ...updatedNode,
          subTasks: updatedSubNodes
        };
      } else {
        return {
          ...updatedNode,
          subData: updatedSubNodes
        };
      }
    }
  }

  return updatedNode;
}

/**
 * Set node mode without propagation
 * Used when user explicitly changes a child node mode
 */
export function setNodeModeWithoutPropagation(
  node: SchemaNode,
  mode: NodeMode
): SchemaNode {
  return {
    ...node,
    mode
  };
}

/**
 * Check if node mode is consistent with children.
 * Returns true if all children have the same mode as parent (when parent is 'ai').
 *
 * RECURSION INVARIANTS:
 * - Only 'ai' mode requires consistency check
 * - Maximum depth: MAX_RECURSION_DEPTH
 *
 * @param node - Node to check
 * @param depth - Current recursion depth (internal, defaults to 0)
 * @returns True if mode is consistent, false otherwise
 *
 * @throws Error if recursion depth exceeds MAX_RECURSION_DEPTH
 */
export function isModeConsistent(node: SchemaNode, depth: number = 0): boolean {
  // INVARIANT: Check recursion depth
  if (depth > MAX_RECURSION_DEPTH) {
    throw new Error(
      `Recursion depth exceeded maximum of ${MAX_RECURSION_DEPTH}. ` +
      `This indicates a circular reference or extremely deep tree structure.`
    );
  }

  if (node.mode !== 'ai') {
    return true; // Only 'ai' mode requires consistency
  }

  const subData = node.subData || [];
  const subTasks = node.subTasks || [];
  const allSubNodes = subTasks.length > 0 ? subTasks : subData;

  return allSubNodes.every(subNode => {
    if (subNode.mode !== 'ai') {
      return false;
    }
    // RECURSIVE CALL: Increment depth
    return isModeConsistent(subNode, depth + 1);
  });
}

/**
 * Get all nodes in AI mode from structure.
 *
 * RECURSION INVARIANTS:
 * - Traverses entire tree structure
 * - Maximum depth: MAX_RECURSION_DEPTH
 *
 * @param structure - Structure to traverse
 * @returns Array of nodes in AI mode
 *
 * @throws Error if recursion depth exceeds MAX_RECURSION_DEPTH
 */
export function getNodesInAIMode(structure: SchemaNode[]): SchemaNode[] {
  const result: SchemaNode[] = [];

  /**
   * Internal recursive traversal function.
   *
   * @param nodes - Nodes to traverse
   * @param depth - Current recursion depth
   */
  function traverse(nodes: SchemaNode[], depth: number = 0): void {
    // INVARIANT: Check recursion depth
    if (depth > MAX_RECURSION_DEPTH) {
      throw new Error(
        `Recursion depth exceeded maximum of ${MAX_RECURSION_DEPTH}. ` +
        `This indicates a circular reference or extremely deep tree structure.`
      );
    }

    for (const node of nodes) {
      if (node.mode === 'ai') {
        result.push(node);
      }
      const subData = node.subData || [];
      const subTasks = node.subTasks || [];
      const allSubNodes = subTasks.length > 0 ? subTasks : subData;
      if (allSubNodes.length > 0) {
        // RECURSIVE CALL: Increment depth
        traverse(allSubNodes, depth + 1);
      }
    }
  }

  traverse(structure);
  return result;
}

/**
 * Get all nodes in manual mode from structure.
 *
 * RECURSION INVARIANTS:
 * - Traverses entire tree structure
 * - Maximum depth: MAX_RECURSION_DEPTH
 *
 * @param structure - Structure to traverse
 * @returns Array of nodes in manual mode
 *
 * @throws Error if recursion depth exceeds MAX_RECURSION_DEPTH
 */
export function getNodesInManualMode(structure: SchemaNode[]): SchemaNode[] {
  const result: SchemaNode[] = [];

  /**
   * Internal recursive traversal function.
   *
   * @param nodes - Nodes to traverse
   * @param depth - Current recursion depth
   */
  function traverse(nodes: SchemaNode[], depth: number = 0): void {
    // INVARIANT: Check recursion depth
    if (depth > MAX_RECURSION_DEPTH) {
      throw new Error(
        `Recursion depth exceeded maximum of ${MAX_RECURSION_DEPTH}. ` +
        `This indicates a circular reference or extremely deep tree structure.`
      );
    }

    for (const node of nodes) {
      if (node.mode === 'manual') {
        result.push(node);
      }
      const subData = node.subData || [];
      const subTasks = node.subTasks || [];
      const allSubNodes = subTasks.length > 0 ? subTasks : subData;
      if (allSubNodes.length > 0) {
        // RECURSIVE CALL: Increment depth
        traverse(allSubNodes, depth + 1);
      }
    }
  }

  traverse(structure);
  return result;
}

/**
 * Check if structure has any nodes in AI mode
 */
export function hasNodesInAIMode(structure: SchemaNode[]): boolean {
  return getNodesInAIMode(structure).length > 0;
}

/**
 * Check if all nodes are in manual mode
 */
export function areAllNodesManual(structure: SchemaNode[]): boolean {
  const aiNodes = getNodesInAIMode(structure);
  return aiNodes.length === 0 && structure.length > 0;
}
