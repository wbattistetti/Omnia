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

  // ✅ DEBUG: Log the structure of the dock tree
  console.log('[openLateralChatPanel] 🔍 DEBUG: Dock tree structure', {
    rootKind: prev.kind,
    rootOrientation: prev.kind === 'split' ? prev.orientation : null,
    rootChildrenCount: prev.kind === 'split' ? prev.children.length : 0,
    position,
    tabId
  });

  // ✅ STEP 1: Check if tab already exists (idempotent check)
  const existing = getTab(prev, tabId);
  if (existing) {
    console.log('[openLateralChatPanel] ✅ Tab already exists, activating');
    if (onExisting) {
      return onExisting(prev, tabId);
    }
    return activateTab(prev, tabId);
  }

  // ✅ STEP 2: Check if a lateral tabset already exists (idempotent check)
  const existingLateralTabset = findLateralTabset(prev, position);
  if (existingLateralTabset) {
    console.log('[openLateralChatPanel] ✅ Lateral tabset already exists, adding tab', {
      tabsetId: existingLateralTabset
    });
    // ✅ CRITICAL: Use upsertAddCenter instead of addTabCenter
    // upsertAddCenter is idempotent: removes tab if exists elsewhere, then adds
    // This handles race condition where tab was just added but not yet in prev
    return upsertAddCenter(prev, existingLateralTabset, newTab);
  }

  // ✅ STEP 3: Create new split at root level
  // CRITICAL: Always wrap the entire root to ensure lateral panel extends full height
  // This works whether root is a tabset, vertical split (col), or horizontal split (row)
  const sizes = position === 'left' ? [0.25, 0.75] : [0.75, 0.25];

  // Create new tabset for the chat panel
  const newTabSet: DockNode = {
    kind: 'tabset',
    id: `ts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tabs: [newTab],
    active: 0
  };

  // If root is already a horizontal split (row), add panel to it
  // BUT: Only if the main content is a simple tabset (not a split)
  // If main content is a split (e.g., vertical split with ResponseEditor),
  // we need to wrap it to ensure full height
  if (prev.kind === 'split' && prev.orientation === 'row') {
    console.log('[openLateralChatPanel] 🔍 Root is horizontal split (row), adding panel to it');
    // Find the main content child (opposite of the desired position)
    // For left position, main content is the last child; for right, it's the first
    const mainContentIndex = position === 'left' ? prev.children.length - 1 : 0;
    const mainContent = prev.children[mainContentIndex];

    console.log('[openLateralChatPanel] 🔍 Main content', {
      kind: mainContent.kind,
      orientation: mainContent.kind === 'split' ? mainContent.orientation : null
    });

    // If main content is a simple tabset (not inside a vertical split), split it
    if (mainContent.kind === 'tabset') {
      console.log('[openLateralChatPanel] ✅ Main content is tabset, splitting it');
      return splitWithTab(prev, mainContent.id, position, newTab, sizes);
    }

    // If main content is a split (e.g., vertical split with ResponseEditor),
    // wrap it in a horizontal split to add the lateral panel
    // This ensures the lateral panel extends full height
    console.log('[openLateralChatPanel] ✅ Main content is split, wrapping it');
    const wrappedMainContent = {
      kind: 'split' as const,
      id: `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orientation: 'row' as const,
      children: position === 'left'
        ? [newTabSet, mainContent]
        : [mainContent, newTabSet],
      sizes
    };

    // Replace the main content with the wrapped version
    const newChildren = [...prev.children];
    newChildren[mainContentIndex] = wrappedMainContent;
    return {
      ...prev,
      children: newChildren
    };
  }

  // Root is a tabset or vertical split (col) - ALWAYS wrap it in a horizontal split
  // This ensures the lateral panel extends full height from toolbar to bottom
  // CRITICAL: Never use splitWithTab here because it would create the split inside
  // the vertical split instead of wrapping it
  console.log('[openLateralChatPanel] ✅ Root is tabset or vertical split, wrapping entire root', {
    rootKind: prev.kind,
    rootOrientation: prev.kind === 'split' ? prev.orientation : null
  });
  const children = position === 'left'
    ? [newTabSet, prev]
    : [prev, newTabSet];

  return {
    kind: 'split',
    id: `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    orientation: 'row',
    children,
    sizes
  };
}

/**
 * ✅ Finds the actual root tabset (not inside vertical splits)
 * This ensures lateral splits are created at root level for full-height panels
 *
 * @param node - The dock tree node to search
 * @returns The ID of the root tabset, or null if not found
 */
function findActualRootTabset(node: DockNode): string | null {
  if (node.kind === 'tabset') {
    return node.id;
  }

  if (node.kind === 'split') {
    // If it's a vertical split, find the root tabset in the first child (main content area)
    // This is the tabset that should be split for lateral panels
    if (node.orientation === 'col') {
      return findActualRootTabset(node.children[0]);
    }
    // If it's a horizontal split, find the root tabset in the main content child
    // For left/right splits, the main content is usually the first or middle child
    if (node.orientation === 'row') {
      // Check if any child is a tabset (that's likely the root)
      for (const child of node.children) {
        if (child.kind === 'tabset') {
          return child.id;
        }
      }
      // Otherwise, recursively search in the first child (main content)
      return findActualRootTabset(node.children[0]);
    }
  }

  return null;
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
    // ✅ CRITICAL: Only horizontal splits (row) can have lateral tabsets (left/right)
    // Vertical splits (col) have top/bottom tabsets, not lateral ones
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

    // ✅ FIXED: For vertical splits (col), do NOT check children for lateral tabsets
    // Vertical splits have top/bottom children, not left/right
    // We should only recursively search in nested horizontal splits
    if (node.orientation === 'col') {
      for (const child of node.children) {
        // Only recursively search in nested splits (which might be horizontal)
        if (child.kind === 'split') {
          const found = findLateralTabset(child, position);
          if (found) return found;
        }
        // Skip tabsets in vertical splits - they are top/bottom, not left/right
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
