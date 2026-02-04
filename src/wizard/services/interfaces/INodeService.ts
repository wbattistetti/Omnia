// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Service Interface
 *
 * Defines the contract for node management services.
 * Provides semantic boundaries and type safety.
 */

import type { SchemaNode, NodeMode } from '../../types/wizard.types';

export interface INodeService {
  /**
   * Update node label.
   *
   * @param node - Node to update
   * @param label - New label
   * @returns Updated node
   */
  updateNodeLabel(node: SchemaNode, label: string): SchemaNode;

  /**
   * Add sub-node to a node.
   *
   * @param node - Parent node
   * @param subNode - Sub-node to add
   * @returns Updated node with new sub-node
   */
  addSubNode(node: SchemaNode, subNode: SchemaNode): SchemaNode;

  /**
   * Remove sub-node from a node.
   *
   * @param node - Parent node
   * @param index - Index of sub-node to remove
   * @returns Updated node without sub-node
   */
  removeSubNode(node: SchemaNode, index: number): SchemaNode;

  /**
   * Update sub-node in a node.
   *
   * @param node - Parent node
   * @param index - Index of sub-node to update
   * @param subNode - Updated sub-node
   * @returns Updated node with updated sub-node
   */
  updateSubNode(node: SchemaNode, index: number, subNode: SchemaNode): SchemaNode;

  /**
   * Set node mode with propagation.
   *
   * @param node - Node to update
   * @param mode - Mode to set
   * @returns Updated node with propagated mode
   *
   * @throws Error if recursion depth exceeds maximum
   */
  setNodeMode(node: SchemaNode, mode: NodeMode): SchemaNode;

  /**
   * Check if node has sub-nodes.
   *
   * @param node - Node to check
   * @returns True if node has sub-nodes
   */
  hasSubNodes(node: SchemaNode): boolean;

  /**
   * Get all sub-nodes from a node.
   *
   * @param node - Node to get sub-nodes from
   * @returns Array of sub-nodes
   */
  getAllSubNodes(node: SchemaNode): SchemaNode[];
}
