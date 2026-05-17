import { describe, expect, it } from 'vitest';
import {
  createDefaultDockTree,
  filterSnapshotToExistingFlows,
  getFlowIdsFromWorkspaceSnapshot,
  serializeDockTreeToSnapshot,
  snapshotFlowIdsAreLoaded,
  type WorkspaceUiSnapshotV1,
} from '../projectWorkspaceUiSnapshot';

describe('projectWorkspaceUiSnapshot', () => {
  it('serializes flow and elevenlabs workspace tabs (v2), skips taskEditor', () => {
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
        {
          id: 'tel_1',
          title: 'EL Agent',
          type: 'elevenlabsWorkspace' as const,
          agentId: 'agent_abc',
          agentName: 'My Agent',
        },
      ],
      active: 2,
    };
    const snap = serializeDockTreeToSnapshot(tree as any);
    expect(snap?.version).toBe(2);
    expect(snap?.root).toMatchObject({
      kind: 'tabset',
      tabs: [
        { flowId: 'main' },
        { type: 'elevenlabsWorkspace', agentId: 'agent_abc', agentName: 'My Agent' },
      ],
      active: 1,
    });
  });

  it('filterSnapshotToExistingFlows keeps elevenlabs tabs when a flow is removed', () => {
    const snap = {
      version: 2 as const,
      root: {
        kind: 'tabset' as const,
        id: 'ts',
        tabs: [
          { id: 't1', title: 'M', type: 'flow' as const, flowId: 'main' },
          { id: 't2', title: 'Gone', type: 'flow' as const, flowId: 'deleted' },
          {
            id: 'tel',
            title: 'EL',
            type: 'elevenlabsWorkspace' as const,
            agentId: 'a1',
          },
        ],
        active: 2,
      },
    };
    const filtered = filterSnapshotToExistingFlows(snap, new Set(['main']));
    expect(filtered?.kind).toBe('tabset');
    if (filtered?.kind === 'tabset') {
      expect(filtered.tabs.map((t) => t.type)).toEqual(['flow', 'elevenlabsWorkspace']);
      expect(filtered.active).toBe(1);
    }
  });

  it('getFlowIdsFromWorkspaceSnapshot collects flow tab ids', () => {
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
    expect(getFlowIdsFromWorkspaceSnapshot(snap).sort()).toEqual(['main', 'sub_abc']);
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
