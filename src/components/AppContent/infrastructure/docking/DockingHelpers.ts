// Infrastructure layer: Docking helper functions
// Uses domain layer and dock/ops utilities

import type { DockNode, DockTab } from '@dock/types';
import { findRootTabset, tabExists, type OpenBottomDockedTabRequest } from '../../domain/dockTree';
import { activateTab, splitWithTab, getTab } from '@dock/ops';

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

  // Find root tabset and open as bottom docked panel
  const rootTabsetId = findRootTabset(prev) || 'ts_main';
  return splitWithTab(prev, rootTabsetId, 'bottom', newTab);
}
