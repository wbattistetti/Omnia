import { describe, it, expect } from 'vitest';
import { createDefaultDockTree } from '../projectWorkspaceUiSnapshot';
import { closeTab } from '../ops';
import { isLockedMainFlowTab } from '../types';

describe('isLockedMainFlowTab', () => {
  it('is true only for flow tab with flowId main', () => {
    expect(isLockedMainFlowTab({ id: 'tab_main', title: 'Main', type: 'flow', flowId: 'main' })).toBe(true);
    expect(isLockedMainFlowTab({ id: 'x', title: 'Other', type: 'flow', flowId: 'other' })).toBe(false);
    expect(isLockedMainFlowTab(null)).toBe(false);
  });
});

describe('closeTab main guard', () => {
  it('does not remove the main flow tab', () => {
    const tree = createDefaultDockTree();
    const next = closeTab(tree, 'tab_main');
    expect(next).toEqual(tree);
  });

  it('removes a non-main flow tab when present', () => {
    const tree = createDefaultDockTree();
    const withExtra = {
      ...tree,
      tabs: [
        ...(tree.kind === 'tabset' ? tree.tabs : []),
        { id: 'tab_x', title: 'X', type: 'flow' as const, flowId: 'x' },
      ],
      active: 1,
    };
    if (withExtra.kind !== 'tabset') throw new Error('expected tabset');
    const closed = closeTab(withExtra, 'tab_x');
    expect(closed.kind).toBe('tabset');
    if (closed.kind === 'tabset') {
      expect(closed.tabs.map((t) => t.id)).toEqual(['tab_main']);
    }
  });
});
