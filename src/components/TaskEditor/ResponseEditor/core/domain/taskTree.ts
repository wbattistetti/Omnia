/**
 * TaskTree Domain Operations
 *
 * Pure functions for TaskTree operations.
 * No side effects, no dependencies on React or state.
 *
 * These functions are extracted from ddtSelectors.ts and treeFactories.ts
 * to create a clean domain layer.
 */

import { validateTaskTreeStructure } from './validators';
import type { TaskTree } from '@types/taskTypes';

/**
 * Get main nodes list from TaskTree - STRICT
 *
 * @param taskTree - The TaskTree to extract nodes from, or null/undefined
 * @returns Array of main nodes (empty array if taskTree is null/undefined)
 *
 * @example
 * ```ts
 * const nodes = getMainNodes(taskTree);
 * // Returns: [{ id: '1', label: 'Node 1', ... }, ...]
 * ```
 */
export function getMainNodes(taskTree: TaskTree | null | undefined): TaskTree['nodes'] {
  if (!taskTree) return [];

  validateTaskTreeStructure(taskTree, 'getMainNodes');

  return taskTree.nodes.filter(Boolean);
}

/**
 * Get sub-nodes list from a main node.
 * Uses only TaskTreeNode.subNodes (no backward compatibility with subData/subSlots).
 *
 * @param main - The main node to extract sub-nodes from
 * @returns Array of sub-nodes (empty array if main is null/undefined or has no subNodes)
 *
 * @example
 * ```ts
 * const subNodes = getSubNodes(mainNode);
 * // Returns: [{ id: '1.1', label: 'Sub-node 1', ... }, ...]
 * ```
 */
export function getSubNodes(main: TaskTree['nodes'][number] | null | undefined): TaskTree['nodes'][number]['subNodes'] {
  if (!main) return [];
  if (Array.isArray(main.subNodes)) {
    return main.subNodes.filter(Boolean);
  }
  return [];
}

/**
 * Check if TaskTree has multiple main nodes
 */
export function hasMultipleMainNodes(taskTree: TaskTree | null | undefined): boolean {
  return getMainNodes(taskTree).length >= 2;
}

/**
 * Find a node in TaskTree by indices
 * Returns null if not found
 */
export function findNodeByIndices(
  taskTree: TaskTree | null | undefined,
  mainIndex: number,
  subIndex: number | null
): any {
  const mains = getMainNodes(taskTree);
  if (mains.length === 0) return null;

  const safeMainIdx = Number.isFinite(mainIndex) && mainIndex >= 0 && mainIndex < mains.length
    ? mainIndex
    : 0;
  const main = mains[safeMainIdx];

  if (subIndex == null) return main;

  const subs = getSubNodes(main);
  if (subs.length === 0) return main;

  // If subIndex is out of bounds, return main node
  const isValidSubIndex = Number.isFinite(subIndex) && subIndex >= 0 && subIndex < subs.length;
  if (!isValidSubIndex) return main;

  // ✅ NO FALLBACKS: subs[subIndex] must exist if isValidSubIndex is true
  // If subIndex is valid but subs[subIndex] is falsy, return main as safe fallback
  return subs[subIndex] ?? main;
}
