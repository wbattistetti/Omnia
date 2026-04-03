// Unit tests for DockingHelpers
import { describe, it, expect, vi } from 'vitest';
import { openBottomDockedTab, findBottomTabsetBelowFlowTabset } from '../DockingHelpers';
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

    it('should bottom-dock under the anchored flow column, not another pane', () => {
      const tree: DockNode = {
        kind: 'split',
        id: 'split_root',
        orientation: 'row',
        children: [
          {
            kind: 'split',
            id: 'split_left_col',
            orientation: 'col',
            children: [
              {
                kind: 'tabset',
                id: 'ts_main',
                tabs: [{ id: 'tab_main', title: 'Main', type: 'flow', flowId: 'main' }],
                active: 0,
              },
              {
                kind: 'tabset',
                id: 'ts_main_bottom',
                tabs: [{ id: 'act_old', title: 'Old', type: 'taskEditor' as const }],
                active: 0,
              },
            ],
            sizes: [0.67, 0.33],
          },
          {
            kind: 'tabset',
            id: 'ts_sub',
            tabs: [{ id: 'tab_sf1', title: 'Subflow', type: 'flow', flowId: 'sf1' }],
            active: 0,
          },
        ],
        sizes: [0.5, 0.5],
      };
      const newTab: DockTab = {
        id: 'act_new',
        title: 'Backend',
        type: 'taskEditor',
      };
      const result = openBottomDockedTab(tree, {
        tabId: 'act_new',
        newTab,
        anchorTabsetId: 'ts_sub',
      });

      expect(result.kind).toBe('split');
      if (result.kind !== 'split' || result.orientation !== 'row') return;
      const right = result.children[1];
      expect(right.kind).toBe('split');
      if (right.kind === 'split' && right.orientation === 'col') {
        expect(right.children[0].kind).toBe('tabset');
        expect(right.children[1].kind).toBe('tabset');
        if (right.children[1].kind === 'tabset') {
          expect(right.children[1].tabs.some((t) => t.id === 'act_new')).toBe(true);
        }
      }
    });

    it('findBottomTabsetBelowFlowTabset returns bottom id when col split exists', () => {
      const tree: DockNode = {
        kind: 'split',
        orientation: 'col',
        id: 'c1',
        children: [
          { kind: 'tabset', id: 'ts_top', tabs: [], active: 0 },
          { kind: 'tabset', id: 'ts_bot', tabs: [], active: 0 },
        ],
        sizes: [0.67, 0.33],
      };
      expect(findBottomTabsetBelowFlowTabset(tree, 'ts_top')).toBe('ts_bot');
      expect(findBottomTabsetBelowFlowTabset(tree, 'ts_other')).toBe(null);
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
