/**
 * Dual-pane dock ops: main + subflow split and opposite-pane reuse.
 */
import { describe, it, expect } from 'vitest';
import type { DockNode, DockTab } from './types';
import {
  findTabsetIdContainingTab,
  findOpposingTabsetIdInRowSplit,
  upsertFlowTabInDualPane,
} from './ops';

const flowTab = (id: string, flowId: string, title: string): DockTab => ({
  id,
  title,
  type: 'flow',
  flowId,
});

describe('upsertFlowTabInDualPane', () => {
  it('splits to the right when only a single tabset exists (main fullscreen)', () => {
    const tree: DockNode = {
      kind: 'tabset',
      id: 'ts_main',
      tabs: [flowTab('tab_main', 'main', 'Main')],
      active: 0,
    };
    const next = upsertFlowTabInDualPane(tree, 'tab_main', flowTab('tab_subflow_x', 'subflow_x', 'Sub A'));
    expect(next.kind).toBe('split');
    if (next.kind !== 'split') throw new Error('expected split');
    expect(next.orientation).toBe('row');
    expect(next.children).toHaveLength(2);
    const left = next.children[0];
    const right = next.children[1];
    expect(left.kind).toBe('tabset');
    expect(right.kind).toBe('tabset');
    if (left.kind === 'tabset' && right.kind === 'tabset') {
      expect(left.tabs.map((t) => t.id)).toContain('tab_main');
      expect(right.tabs.map((t) => t.id)).toEqual(['tab_subflow_x']);
    }
  });

  it('reuses the opposite pane when a horizontal split already exists (no third panel)', () => {
    const mainTs: DockNode = {
      kind: 'tabset',
      id: 'ts_left',
      tabs: [flowTab('tab_main', 'main', 'Main')],
      active: 0,
    };
    const subTs: DockNode = {
      kind: 'tabset',
      id: 'ts_right',
      tabs: [flowTab('tab_sub_old', 'subflow_old', 'Old sub')],
      active: 0,
    };
    const tree: DockNode = {
      kind: 'split',
      id: 'split_root',
      orientation: 'row',
      children: [mainTs, subTs],
      sizes: [0.5, 0.5],
    };

    const next = upsertFlowTabInDualPane(tree, 'tab_main', flowTab('tab_sub_new', 'subflow_new', 'New sub'));
    expect(next.kind).toBe('split');
    if (next.kind !== 'split') throw new Error('expected split');
    const right = next.children[1];
    expect(right.kind).toBe('tabset');
    if (right.kind === 'tabset') {
      expect(right.tabs.map((t) => t.id)).toEqual(['tab_sub_new']);
      expect(right.tabs[0]?.flowId).toBe('subflow_new');
    }
    const left = next.children[0];
    if (left.kind === 'tabset') {
      expect(left.tabs.map((t) => t.id)).toContain('tab_main');
    }
  });

  it('opens in the left pane when the subflow click originates from the right tab', () => {
    const mainTs: DockNode = {
      kind: 'tabset',
      id: 'ts_left',
      tabs: [flowTab('tab_main', 'main', 'Main')],
      active: 0,
    };
    const subTs: DockNode = {
      kind: 'tabset',
      id: 'ts_right',
      tabs: [flowTab('tab_sub_old', 'subflow_old', 'Old sub')],
      active: 0,
    };
    const tree: DockNode = {
      kind: 'split',
      id: 'split_root',
      orientation: 'row',
      children: [mainTs, subTs],
      sizes: [0.5, 0.5],
    };

    const next = upsertFlowTabInDualPane(tree, 'tab_sub_old', flowTab('tab_sub_new', 'subflow_new', 'New sub'));
    const left = next.kind === 'split' ? next.children[0] : null;
    expect(left?.kind).toBe('tabset');
    if (left?.kind === 'tabset') {
      expect(left.tabs.map((t) => t.id)).toEqual(['tab_sub_new']);
    }
    const right = next.kind === 'split' ? next.children[1] : null;
    if (right?.kind === 'tabset') {
      expect(right.tabs.map((t) => t.id)).toContain('tab_sub_old');
    }
  });
});

describe('findTabsetIdContainingTab / findOpposingTabsetIdInRowSplit', () => {
  it('finds tabset for a tab id', () => {
    const tree: DockNode = {
      kind: 'tabset',
      id: 'ts_main',
      tabs: [flowTab('tab_main', 'main', 'Main')],
      active: 0,
    };
    expect(findTabsetIdContainingTab(tree, 'tab_main')).toBe('ts_main');
    expect(findTabsetIdContainingTab(tree, 'missing')).toBeNull();
  });

  it('finds opposing tabset in a row split', () => {
    const tree: DockNode = {
      kind: 'split',
      id: 's',
      orientation: 'row',
      children: [
        { kind: 'tabset', id: 'L', tabs: [flowTab('t1', 'a', 'A')], active: 0 },
        { kind: 'tabset', id: 'R', tabs: [flowTab('t2', 'b', 'B')], active: 0 },
      ],
      sizes: [0.5, 0.5],
    };
    expect(findOpposingTabsetIdInRowSplit(tree, 'L')).toBe('R');
    expect(findOpposingTabsetIdInRowSplit(tree, 'R')).toBe('L');
  });
});
