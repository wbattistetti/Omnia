import { describe, expect, it, vi } from 'vitest';

vi.mock('@flows/FlowPersistence', () => ({
  loadFlow: vi.fn(),
}));

import { loadFlow } from '@flows/FlowPersistence';
import { prefetchHydratedFlowSlicesFromServer } from '../prefetchSnapshotFlowSlices';

describe('prefetchHydratedFlowSlicesFromServer', () => {
  it('upserts when superseded but slice graph is still empty', async () => {
    const upsertFlow = vi.fn();
    vi.mocked(loadFlow).mockResolvedValue({
      nodes: [{ id: 'n1', position: { x: 0, y: 0 } }],
      edges: [],
      tasks: [],
      variables: [],
      bindings: [],
    } as any);

    await prefetchHydratedFlowSlicesFromServer(
      'proj_1',
      ['main'],
      {
        getFlows: () => ({
          main: {
            id: 'main',
            title: 'Main',
            nodes: [],
            edges: [],
            hydrated: false,
            hasLocalChanges: false,
          },
        }),
        upsertFlow,
      },
      { isSuperseded: () => true }
    );

    expect(upsertFlow).toHaveBeenCalledTimes(1);
    expect(upsertFlow.mock.calls[0][0].nodes).toHaveLength(1);
    expect(upsertFlow.mock.calls[0][0].hydrated).toBe(true);
  });

  it('skips upsert when superseded and slice already has nodes', async () => {
    const upsertFlow = vi.fn();
    vi.mocked(loadFlow).mockResolvedValue({
      nodes: [{ id: 'n1', position: { x: 0, y: 0 } }],
      edges: [],
      tasks: [],
      variables: [],
      bindings: [],
    } as any);

    await prefetchHydratedFlowSlicesFromServer(
      'proj_1',
      ['main'],
      {
        getFlows: () => ({
          main: {
            id: 'main',
            title: 'Main',
            nodes: [{ id: 'existing', position: { x: 1, y: 2 } }],
            edges: [],
            hydrated: true,
            hasLocalChanges: false,
          },
        }),
        upsertFlow,
      },
      { isSuperseded: () => true }
    );

    expect(upsertFlow).not.toHaveBeenCalled();
  });
});
