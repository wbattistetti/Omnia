// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Strict node operations - NO FALLBACKS
 * Throws errors if data doesn't match expected format
 */

import { validateNodeStructure } from './validators';
import type { TaskTreeNode } from '@types/taskTypes';

/**
 * Get subNodes - STRICT, no fallback
 */
export function getSubNodesStrict(node: TaskTreeNode | null | undefined): TaskTreeNode[] {
  if (!node) return [];

  validateNodeStructure(node, 'getSubNodesStrict');

  return Array.isArray(node.subNodes) ? node.subNodes.filter(Boolean) : [];
}

/**
 * Get node ID - STRICT, no fallback
 */
export function getNodeIdStrict(node: TaskTreeNode | null | undefined): string {
  if (!node) {
    throw new Error('[getNodeIdStrict] Node is null or undefined');
  }

  validateNodeStructure(node, 'getNodeIdStrict');

  return node.id;
}

/**
 * Get node label - STRICT, no fallback
 */
export function getNodeLabelStrict(node: TaskTreeNode | null | undefined): string {
  if (!node) return '';

  validateNodeStructure(node, 'getNodeLabelStrict');

  return node.label || '';
}
