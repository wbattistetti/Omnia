// Domain layer: Dock tree pure functions
// ✅ PURE FUNCTIONS - No dependencies, no side effects

import type { DockNode, DockTab } from '@dock/types';
import { getTab } from '@dock/ops';

/**
 * Finds the root tabset in a dock tree
 *
 * @pure - No side effects, deterministic
 * @param n - Dock node to search
 * @returns Root tabset ID or null if not found
 *
 * @example
 * ```typescript
 * const tree: DockNode = { kind: 'tabset', id: 'ts_main', tabs: [], active: 0 };
 * const rootId = findRootTabset(tree); // 'ts_main'
 * ```
 */
export function findRootTabset(n: DockNode): string | null {
  if (n.kind === 'tabset') return n.id;
  if (n.kind === 'split') {
    // Prefer the first child (usually the main canvas)
    if (n.children.length > 0) {
      const found = findRootTabset(n.children[0]);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Checks if a tab exists in the dock tree
 *
 * @pure - No side effects, deterministic
 * @param tree - Dock tree to search
 * @param tabId - Tab ID to find
 * @returns True if tab exists, false otherwise
 *
 * @example
 * ```typescript
 * const exists = tabExists(tree, 'tab_main'); // true or false
 * ```
 */
export function tabExists(tree: DockNode, tabId: string): boolean {
  return getTab(tree, tabId) !== null;
}

/**
 * Domain model for opening a bottom-docked tab
 */
export interface OpenBottomDockedTabRequest {
  tabId: string;
  newTab: DockTab;
  onExisting?: (tree: DockNode, tabId: string) => DockNode;
}
