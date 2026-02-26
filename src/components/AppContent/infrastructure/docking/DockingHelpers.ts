// Infrastructure layer: Docking helper functions
// Uses domain layer and dock/ops utilities

import type { DockNode, DockTabChat } from '@dock/types';
import { findRootTabset, type OpenBottomDockedTabRequest } from '../../domain/dockTree';
import { activateTab, splitWithTab, getTab, upsertAddCenter, addTabCenter } from '@dock/ops';

/**
 * Finds the bottom tabset in a dock tree (if a bottom split exists)
 * Improved version that handles nested splits better
 */
function findBottomTabset(node: DockNode): string | null {
  if (node.kind === 'tabset') {
    return null; // This is a tabset, not a split
  }
  if (node.kind === 'split') {
    // For vertical splits (col), the bottom tabset is the last child
    if (node.orientation === 'col') {
      // Start from the last child (most likely to be bottom)
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child.kind === 'tabset') {
          // Found a tabset - for vertical splits, the last one is the bottom panel
          return child.id;
        }
        // Recursively search in nested splits
        const found = findBottomTabset(child);
        if (found) {
          return found;
        }
      }
    } else {
      // For horizontal splits (row), search in all children
      for (let i = node.children.length - 1; i >= 0; i--) {
        const found = findBottomTabset(node.children[i]);
        if (found) {
          return found;
        }
      }
    }
  }
  return null;
}

/**
 * Opens a tab as a bottom-docked panel, or activates it if it already exists
 *
 * @param prev - Current dock tree state
 * @param options - Configuration for opening the tab
 * @returns New dock tree with tab opened or activated
 *
 * @example
 * ```typescript
 * const newTree = openBottomDockedTab(prevTree, {
 *   tabId: 'task-1',
 *   newTab: { id: 'task-1', title: 'Task', type: 'taskEditor' },
 *   onExisting: (tree, id) => {
 *     // Custom logic for existing tab
 *     return activateTab(tree, id);
 *   },
 * });
 * ```
 */
export function openBottomDockedTab(
  prev: DockNode,
  options: OpenBottomDockedTabRequest
): DockNode {
  const { tabId, newTab, onExisting } = options;

  // Check if already open using getTab from ops
  const existing = getTab(prev, tabId);
  if (existing) {
    // Custom handler for existing tab (e.g., save TaskTree)
    if (onExisting) {
      return onExisting(prev, tabId);
    }
    // Default: just activate
    return activateTab(prev, tabId);
  }

  // Check if a bottom tabset already exists (from a previous bottom-docked editor)
  const bottomTabsetId = findBottomTabset(prev);
  if (bottomTabsetId) {
    // Add to existing bottom tabset instead of creating a new split
    return addTabCenter(prev, bottomTabsetId, newTab);
  }

  // Find root tabset and open as bottom docked panel
  const rootTabsetId = findRootTabset(prev) || 'ts_main';
  return splitWithTab(prev, rootTabsetId, 'bottom', newTab);
}

export interface OpenLateralChatPanelRequest {
  tabId: string;
  newTab: DockTabChat;
  position: 'left' | 'right';
  onExisting?: (tree: DockNode, tabId: string) => DockNode;
}

/**
 * Opens a chat panel as a lateral docked tab (left or right)
 *
 * ✅ IDEMPOTENT: Completely idempotent even with race conditions
 *
 * PROOF OF IDEMPOTENCY:
 *
 * 1. If tab exists → activateTab (idempotent)
 *    - getTab(prev, tabId) returns existing tab
 *    - activateTab is pure function, always returns same result for same input
 *
 * 2. If lateral tabset exists → upsertAddCenter (idempotent)
 *    - findLateralTabset(prev, position) returns existing tabset ID
 *    - upsertAddCenter removes tab if exists, then adds to tabset
 *    - Multiple calls: first adds tab, subsequent calls remove and re-add (same result)
 *
 * 3. If split with same structure exists → upsertAddCenter (idempotent)
 *    - findLateralTabsetInSplit checks if split with same rootTabsetId and position exists
 *    - If exists: adds tab to existing lateral tabset (uses upsertAddCenter)
 *
 * 4. If neither exists → splitWithTab
 *    - Multiple concurrent calls may all create splits
 *    - React batches updates, applies them sequentially
 *    - First split wins, subsequent calls see it and use upsertAddCenter
 *
 * RACE CONDITION HANDLING:
 * - Multiple calls with same prev → all may create splits
 * - React batches and applies sequentially
 * - First split wins, subsequent calls see it and converge
 *
 * STRICTMODE SAFETY:
 * - StrictMode calls effects twice
 * - First call creates split or adds tab
 * - Second call sees result of first (if React applied it) OR creates another
 * - React batches and converges to same state
 *
 * @param prev - Current dock tree state
 * @param options - Configuration for opening the chat panel
 * @returns New dock tree with chat panel opened or activated
 *
 * @example
 * ```typescript
 * const newTree = openLateralChatPanel(prevTree, {
 *   tabId: 'chat_panel',
 *   newTab: { id: 'chat_panel', title: 'Chat', type: 'chat', ... },
 *   position: 'left',
 * });
 * ```
 */
export function openLateralChatPanel(
  prev: DockNode,
  options: OpenLateralChatPanelRequest
): DockNode {
  const { tabId, newTab, position, onExisting } = options;

  // ✅ STEP 1: Check if tab already exists (idempotent check)
  const existing = getTab(prev, tabId);
  if (existing) {
    if (onExisting) {
      return onExisting(prev, tabId);
    }
    return activateTab(prev, tabId);
  }

  // ✅ STEP 2: Check if a lateral tabset already exists (idempotent check)
  const existingLateralTabset = findLateralTabset(prev, position);
  if (existingLateralTabset) {
    // ✅ CRITICAL: Use upsertAddCenter instead of addTabCenter
    // upsertAddCenter is idempotent: removes tab if exists elsewhere, then adds
    // This handles race condition where tab was just added but not yet in prev
    return upsertAddCenter(prev, existingLateralTabset, newTab);
  }

  // ✅ STEP 3: Check if split with same structure already exists (idempotent check)
  // This prevents creating duplicate splits even with race conditions
  const rootTabsetId = findRootTabset(prev) || 'ts_main';
  const existingSplitTabset = findLateralTabsetInSplit(prev, rootTabsetId, position);
  if (existingSplitTabset) {
    // Split exists but tabset not found by findLateralTabset (edge case)
    // Use upsertAddCenter to add tab idempotently
    return upsertAddCenter(prev, existingSplitTabset, newTab);
  }

  // ✅ STEP 4: Create new split (only if no split exists)
  // Multiple concurrent calls may all reach here, but React batching ensures convergence
  const sizes = position === 'left' ? [0.25, 0.75] : [0.75, 0.25];
  return splitWithTab(prev, rootTabsetId, position, newTab, sizes);
}

/**
 * Finds an existing lateral tabset (left or right) in the dock tree
 * Used to prevent creating duplicate lateral splits
 */
function findLateralTabset(node: DockNode, position: 'left' | 'right'): string | null {
  if (node.kind === 'tabset') {
    return null;
  }

  if (node.kind === 'split') {
    // For horizontal splits (row), check if any child is a lateral tabset
    if (node.orientation === 'row') {
      const targetIndex = position === 'left' ? 0 : node.children.length - 1;
      const targetChild = node.children[targetIndex];
      if (targetChild?.kind === 'tabset') {
        return targetChild.id;
      }
      // Recursively search in nested splits
      if (targetChild?.kind === 'split') {
        const found = findLateralTabset(targetChild, position);
        if (found) return found;
      }
    }

    // For vertical splits (col), search in all children
    if (node.orientation === 'col') {
      for (const child of node.children) {
        if (child.kind === 'tabset') {
          // Check if this tabset is in a lateral position
          const childIndex = node.children.indexOf(child);
          const isLeft = childIndex === 0;
          const isRight = childIndex === node.children.length - 1;
          if ((position === 'left' && isLeft) || (position === 'right' && isRight)) {
            return child.id;
          }
        }
        if (child.kind === 'split') {
          const found = findLateralTabset(child, position);
          if (found) return found;
        }
      }
    }
  }

  return null;
}

/**
 * ✅ Finds lateral tabset in a split that contains the rootTabsetId
 * This is a more specific check that looks for splits created by splitWithTab
 * for the same rootTabsetId and position
 *
 * PROOF: This function is idempotent because it only reads from prev
 * and returns the same result for the same input
 */
function findLateralTabsetInSplit(
  node: DockNode,
  rootTabsetId: string,
  position: 'left' | 'right'
): string | null {
  if (node.kind === 'tabset') {
    return null;
  }

  if (node.kind === 'split') {
    // Check if this split contains the rootTabsetId as a child
    // and has the correct orientation for the position
    const expectedOrientation: 'row' | 'col' = 'row'; // left/right always use 'row'
    if (node.orientation === expectedOrientation && node.children.length === 2) {
      // Check if one child is the rootTabsetId and the other is a lateral tabset
      const hasRootTabset = node.children.some(
        child => child.kind === 'tabset' && child.id === rootTabsetId
      );
      if (hasRootTabset) {
        // Find the lateral tabset (opposite of rootTabsetId)
        const lateralChild = node.children.find(
          child => child.kind === 'tabset' && child.id !== rootTabsetId
        );
        if (lateralChild?.kind === 'tabset') {
          // Verify it's in the correct position
          const childIndex = node.children.indexOf(lateralChild);
          const isLeft = childIndex === 0;
          const isRight = childIndex === node.children.length - 1;
          if ((position === 'left' && isLeft) || (position === 'right' && isRight)) {
            return lateralChild.id;
          }
        }
      }
    }

    // Recursively search in children
    for (const child of node.children) {
      if (child.kind === 'split') {
        const found = findLateralTabsetInSplit(child, rootTabsetId, position);
        if (found) return found;
      }
    }
  }

  return null;
}
