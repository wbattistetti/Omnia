// Unit tests for dockTree domain functions
import { describe, it, expect } from 'vitest';
import { findRootTabset, tabExists } from '../dockTree';
import type { DockNode, DockTab } from '@dock/types';

describe('dockTree domain functions', () => {
  describe('findRootTabset', () => {
    it('should return root tabset id for simple tabset', () => {
      const tree: DockNode = {
        kind: 'tabset',
        id: 'ts_main',
        tabs: [],
        active: 0,
      };
      expect(findRootTabset(tree)).toBe('ts_main');
    });

    it('should return null for empty split', () => {
      const tree: DockNode = {
        kind: 'split',
        id: 'split_1',
        orientation: 'row',
        children: [],
        sizes: undefined,
      };
      expect(findRootTabset(tree)).toBeNull();
    });

    it('should find root tabset in nested split structure', () => {
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
          {
            kind: 'tabset',
            id: 'ts_secondary',
            tabs: [],
            active: 0,
          },
        ],
        sizes: [0.5, 0.5],
      };
      expect(findRootTabset(tree)).toBe('ts_main');
    });

    it('should find root tabset in deeply nested structure', () => {
      const tree: DockNode = {
        kind: 'split',
        id: 'split_1',
        orientation: 'col',
        children: [
          {
            kind: 'split',
            id: 'split_2',
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
          },
        ],
        sizes: undefined,
      };
      expect(findRootTabset(tree)).toBe('ts_main');
    });

    it('should return first child tabset when multiple exist', () => {
      const tree: DockNode = {
        kind: 'split',
        id: 'split_1',
        orientation: 'row',
        children: [
          {
            kind: 'tabset',
            id: 'ts_first',
            tabs: [],
            active: 0,
          },
          {
            kind: 'tabset',
            id: 'ts_second',
            tabs: [],
            active: 0,
          },
        ],
        sizes: [0.5, 0.5],
      };
      expect(findRootTabset(tree)).toBe('ts_first');
    });
  });

  describe('tabExists', () => {
    it('should return true if tab exists in root tabset', () => {
      const tab: DockTab = {
        id: 'tab_main',
        title: 'Main',
        type: 'flow',
      };
      const tree: DockNode = {
        kind: 'tabset',
        id: 'ts_main',
        tabs: [tab],
        active: 0,
      };
      expect(tabExists(tree, 'tab_main')).toBe(true);
    });

    it('should return false if tab does not exist', () => {
      const tree: DockNode = {
        kind: 'tabset',
        id: 'ts_main',
        tabs: [],
        active: 0,
      };
      expect(tabExists(tree, 'tab_nonexistent')).toBe(false);
    });

    it('should find tab in nested split structure', () => {
      const tab: DockTab = {
        id: 'tab_nested',
        title: 'Nested',
        type: 'flow',
      };
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
          {
            kind: 'tabset',
            id: 'ts_secondary',
            tabs: [tab],
            active: 0,
          },
        ],
        sizes: [0.5, 0.5],
      };
      expect(tabExists(tree, 'tab_nested')).toBe(true);
    });
  });
});
