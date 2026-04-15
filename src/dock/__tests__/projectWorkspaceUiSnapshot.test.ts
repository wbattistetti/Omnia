import { describe, expect, it } from 'vitest';
import {
  createDefaultDockTree,
  filterSnapshotToExistingFlows,
  serializeDockTreeToSnapshot,
  snapshotFlowIdsAreLoaded,
  type WorkspaceUiSnapshotV1,
} from '../projectWorkspaceUiSnapshot';

describe('projectWorkspaceUiSnapshot', () => {
  it('serializes only flow tabs', () => {
    const tree = {
      kind: 'tabset' as const,
      id: 'ts_main',
      tabs: [
        { id: 'tab_main', title: 'Main', type: 'flow' as const, flowId: 'main' },
        {
          id: 'te_1',
          title: 'Editor',
          type: 'taskEditor' as const,
          task: { id: 'x', instanceId: 'x', type: 1 },
        },
      ],
      active: 0,
    };
    const snap = serializeDockTreeToSnapshot(tree as any);
    expect(snap?.root).toMatchObject({
      kind: 'tabset',
      tabs: [{ flowId: 'main' }],
    });
  });

  it('snapshotFlowIdsAreLoaded is false until all flows exist', () => {
    const snap: WorkspaceUiSnapshotV1 = {
      version: 1,
      root: {
        kind: 'tabset',
        id: 'ts',
        tabs: [
          { id: 't1', title: 'M', type: 'flow', flowId: 'main' },
          { id: 't2', title: 'S', type: 'flow', flowId: 'sub_abc' },
        ],
        active: 1,
      },
    };
    expect(snapshotFlowIdsAreLoaded(snap, new Set(['main']))).toBe(false);
    expect(snapshotFlowIdsAreLoaded(snap, new Set(['main', 'sub_abc']))).toBe(true);
  });

  it('filterSnapshotToExistingFlows drops missing flow ids', () => {
    const snap: WorkspaceUiSnapshotV1 = {
      version: 1,
      root: {
        kind: 'tabset',
        id: 'ts',
        tabs: [
          { id: 't1', title: 'M', type: 'flow', flowId: 'main' },
          { id: 't2', title: 'Gone', type: 'flow', flowId: 'deleted' },
        ],
        active: 1,
      },
    };
    const filtered = filterSnapshotToExistingFlows(snap, new Set(['main']));
    expect(filtered?.kind).toBe('tabset');
    if (filtered?.kind === 'tabset') {
      expect(filtered.tabs.map((t) => t.flowId)).toEqual(['main']);
      expect(filtered.active).toBe(0);
    }
  });

  it('createDefaultDockTree has main', () => {
    const d = createDefaultDockTree();
    expect(d.kind).toBe('tabset');
    if (d.kind === 'tabset') {
      expect(d.tabs[0]?.type).toBe('flow');
      expect((d.tabs[0] as { flowId: string }).flowId).toBe('main');
    }
  });
});
