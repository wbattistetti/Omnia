import { describe, expect, it } from 'vitest';
import { shouldMountFlowCanvasGraph } from '../flowCanvasDisplayPolicy';

describe('flowCanvasDisplayPolicy', () => {
  it('defers mount while server load is in flight with empty graph', () => {
    expect(
      shouldMountFlowCanvasGraph({
        projectId: 'proj_1',
        flowId: 'main',
        nodeCount: 0,
        edgeCount: 0,
        isHostLoading: true,
      })
    ).toBe(false);
  });

  it('mounts when nodes are present', () => {
    expect(
      shouldMountFlowCanvasGraph({
        projectId: 'proj_1',
        flowId: 'main',
        nodeCount: 2,
        edgeCount: 0,
        isHostLoading: true,
      })
    ).toBe(true);
  });

  it('mounts confirmed empty server graph', () => {
    expect(
      shouldMountFlowCanvasGraph({
        projectId: 'proj_1',
        flowId: 'main',
        nodeCount: 0,
        edgeCount: 0,
        hydrated: true,
        serverHydrationApplied: true,
        isHostLoading: false,
      })
    ).toBe(true);
  });
});
