// Unit tests for DockingHelpers
import { describe, it, expect, vi } from 'vitest';
import { openBottomDockedTab } from '../DockingHelpers';
import type { DockNode, DockTab } from '@dock/types';
import { activateTab } from '@dock/ops';

describe('DockingHelpers', () => {
  describe('openBottomDockedTab', () => {
    it('should open new tab as bottom panel', () => {
      const tree: DockNode = {
        kind: 'tabset',
        id: 'ts_main',
        tabs: [],
        active: 0,
      };
      const newTab: DockTab = {
        id: 'new-tab',
        title: 'New Tab',
        type: 'flow',
      };
      const result = openBottomDockedTab(tree, {
        tabId: 'new-tab',
        newTab,
      });

      // Should create a split with bottom panel
      expect(result.kind).toBe('split');
      if (result.kind === 'split') {
        expect(result.orientation).toBe('col');
        expect(result.children.length).toBe(2);
        // First child should be original tabset
        expect(result.children[0].kind).toBe('tabset');
        // Second child should be new tabset with new tab
        expect(result.children[1].kind).toBe('tabset');
        if (result.children[1].kind === 'tabset') {
          expect(result.children[1].tabs).toHaveLength(1);
          expect(result.children[1].tabs[0].id).toBe('new-tab');
        }
      }
    });

    it('should activate existing tab by default', () => {
      const existingTab: DockTab = {
        id: 'existing-tab',
        title: 'Existing',
        type: 'flow',
      };
      const tree: DockNode = {
        kind: 'tabset',
        id: 'ts_main',
        tabs: [existingTab],
        active: 0,
      };
      const newTab: DockTab = {
        id: 'existing-tab',
        title: 'Existing',
        type: 'flow',
      };
      const result = openBottomDockedTab(tree, {
        tabId: 'existing-tab',
        newTab,
      });

      // Should activate existing tab (same tree structure)
      expect(result.kind).toBe('tabset');
      if (result.kind === 'tabset') {
        expect(result.tabs).toHaveLength(1);
        expect(result.active).toBe(0);
      }
    });

    it('should use custom onExisting handler when provided', () => {
      const existingTab: DockTab = {
        id: 'existing-tab',
        title: 'Existing',
        type: 'flow',
      };
      const tree: DockNode = {
        kind: 'tabset',
        id: 'ts_main',
        tabs: [existingTab],
        active: 0,
      };
      const newTab: DockTab = {
        id: 'existing-tab',
        title: 'Existing',
        type: 'flow',
      };
      const customHandler = vi.fn((t: DockNode, id: string) => {
        return activateTab(t, id);
      });

      const result = openBottomDockedTab(tree, {
        tabId: 'existing-tab',
        newTab,
        onExisting: customHandler,
      });

      expect(customHandler).toHaveBeenCalledWith(tree, 'existing-tab');
      expect(result.kind).toBe('tabset');
    });

    it('should handle nested split structure', () => {
      const tree: DockNode = {
        kind: 'split',
        id: 'split_1',
        orientation: 'row',
        children: [
          {
            kind: 'tabset',
            id: 'ts_main',
            tabs: [],
            active: 0,
          },
        ],
        sizes: undefined,
      };
      const newTab: DockTab = {
        id: 'new-tab',
        title: 'New Tab',
        type: 'flow',
      };
      const result = openBottomDockedTab(tree, {
        tabId: 'new-tab',
        newTab,
      });

      // Should create nested split structure
      expect(result.kind).toBe('split');
    });
  });
});
