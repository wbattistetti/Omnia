/**
 * TaskTree Domain Operations
 *
 * Pure functions for TaskTree operations.
 * No side effects, no dependencies on React or state.
 *
 * These functions are extracted from ddtSelectors.ts and treeFactories.ts
 * to create a clean domain layer.
 */

import { getNodesWithFallback } from '@utils/taskTreeMigrationHelpers';
import type { TaskTree } from '@types/taskTypes';

/**
 * Get main nodes list from TaskTree
 * Uses migration helper with fallback support
 */
export function getMainNodes(taskTree: TaskTree | null | undefined): any[] {
  if (!taskTree) return [];
  return getNodesWithFallback(taskTree, 'getdataList');
}

/**
 * Get sub-nodes list from a main node
 * Uses only TaskTreeNode.subNodes (no backward compatibility)
 */
export function getSubNodes(main: any): any[] {
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

  return subs[subIndex] || main;
}
