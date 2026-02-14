// Infrastructure layer: Docking helper functions
// Uses domain layer and dock/ops utilities

import type { DockNode, DockTab, DockTabChat } from '@dock/types';
import { findRootTabset, tabExists, type OpenBottomDockedTabRequest } from '../../domain/dockTree';
import { activateTab, splitWithTab, getTab, addTabCenter } from '@dock/ops';

/**
 * Finds the bottom tabset in a dock tree (if a bottom split exists)
 * Improved version that handles nested splits better
 */
function findBottomTabset(node: DockNode, depth: number = 0): string | null {
  const indent = '  '.repeat(depth);
  console.log(`[findBottomTabset] ${indent}Checking node:`, {
    kind: node.kind,
    id: node.kind === 'tabset' ? node.id : node.kind === 'split' ? node.id : 'unknown',
    orientation: node.kind === 'split' ? node.orientation : undefined,
    childrenCount: node.kind === 'split' ? node.children.length : 0,
    depth,
  });

  if (node.kind === 'tabset') {
    console.log(`[findBottomTabset] ${indent}Found tabset:`, node.id, '- returning null (not a split)');
    return null; // This is a tabset, not a split
  }
  if (node.kind === 'split') {
    // For vertical splits (col), the bottom tabset is the last child
    if (node.orientation === 'col') {
      console.log(`[findBottomTabset] ${indent}Vertical split (col) with ${node.children.length} children`);
      // Start from the last child (most likely to be bottom)
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        console.log(`[findBottomTabset] ${indent}Checking child ${i}:`, {
          kind: child.kind,
          id: child.kind === 'tabset' ? child.id : child.kind === 'split' ? child.id : 'unknown',
        });
        if (child.kind === 'tabset') {
          // Found a tabset - for vertical splits, the last one is the bottom panel
          console.log(`[findBottomTabset] ${indent}✅ Found bottom tabset:`, child.id);
          return child.id;
        }
        // Recursively search in nested splits
        const found = findBottomTabset(child, depth + 1);
        if (found) {
          console.log(`[findBottomTabset] ${indent}✅ Found bottom tabset recursively:`, found);
          return found;
        }
      }
      console.log(`[findBottomTabset] ${indent}❌ No bottom tabset found in vertical split`);
    } else {
      // For horizontal splits (row), search in all children
      console.log(`[findBottomTabset] ${indent}Horizontal split (row) with ${node.children.length} children`);
      for (let i = node.children.length - 1; i >= 0; i--) {
        const found = findBottomTabset(node.children[i], depth + 1);
        if (found) {
          console.log(`[findBottomTabset] ${indent}✅ Found bottom tabset in horizontal split:`, found);
          return found;
        }
      }
      console.log(`[findBottomTabset] ${indent}❌ No bottom tabset found in horizontal split`);
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

  console.log('[openBottomDockedTab] 🚀 Opening tab:', {
    tabId,
    tabType: newTab.type,
    tabTitle: newTab.title,
  });

  // Check if already open using getTab from ops
  const existing = getTab(prev, tabId);
  if (existing) {
    console.log('[openBottomDockedTab] ⚠️ Tab already exists, activating:', tabId);
    // Custom handler for existing tab (e.g., save TaskTree)
    if (onExisting) {
      return onExisting(prev, tabId);
    }
    // Default: just activate
    return activateTab(prev, tabId);
  }

  // Check if a bottom tabset already exists (from a previous bottom-docked editor)
  console.log('[openBottomDockedTab] 🔍 Searching for existing bottom tabset...');
  const bottomTabsetId = findBottomTabset(prev);
  if (bottomTabsetId) {
    console.log('[openBottomDockedTab] ✅ Found existing bottom tabset:', bottomTabsetId);
    console.log('[openBottomDockedTab] ➕ Adding tab to existing bottom tabset');
    // Add to existing bottom tabset instead of creating a new split
    const result = addTabCenter(prev, bottomTabsetId, newTab);
    console.log('[openBottomDockedTab] ✅ Tab added to bottom tabset');
    return result;
  }

  // Find root tabset and open as bottom docked panel
  console.log('[openBottomDockedTab] ❌ No bottom tabset found, creating new split');
  const rootTabsetId = findRootTabset(prev) || 'ts_main';
  console.log('[openBottomDockedTab] 📍 Root tabset ID:', rootTabsetId);
  const result = splitWithTab(prev, rootTabsetId, 'bottom', newTab);
  console.log('[openBottomDockedTab] ✅ Created new bottom split');
  return result;
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

  console.log('[openLateralChatPanel] 🚀 Opening chat panel:', {
    tabId,
    position,
    tabTitle: newTab.title,
  });

  // Check if already open
  const existing = getTab(prev, tabId);
  if (existing) {
    console.log('[openLateralChatPanel] ⚠️ Chat panel already exists, activating:', tabId);
    if (onExisting) {
      return onExisting(prev, tabId);
    }
    return activateTab(prev, tabId);
  }

  // Find root tabset and open as lateral panel
  const rootTabsetId = findRootTabset(prev) || 'ts_main';
  console.log('[openLateralChatPanel] 📍 Root tabset ID:', rootTabsetId);
  // Default sizes: 25% for chat panel, 75% for main content
  const sizes = position === 'left' ? [0.25, 0.75] : [0.75, 0.25];
  const result = splitWithTab(prev, rootTabsetId, position, newTab, sizes);
  console.log('[openLateralChatPanel] ✅ Created new lateral split');
  return result;
}
