import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resolveExistingFlowSliceForSubflowOpen } from '../subflowOpenResolveSlice';
import { FlowWorkspaceSnapshot } from '../FlowWorkspaceSnapshot';
import type { Flow } from '../FlowTypes';

describe('resolveExistingFlowSliceForSubflowOpen', () => {
  const makeSlice = (id: string): Flow =>
    ({
      id,
      title: 'S',
      nodes: [{ id: 'n1' } as any],
      edges: [],
      hydrated: true,
      hasLocalChanges: true,
    }) as Flow;

  beforeEach(() => {
    vi.spyOn(FlowWorkspaceSnapshot, 'getFlowById').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns slice from flowsRef when present', () => {
    const flowId = 'subflow_a';
    const slice = makeSlice(flowId);
    const flowsRef = { current: { [flowId]: slice } };
    expect(resolveExistingFlowSliceForSubflowOpen(flowId, flowsRef)).toBe(slice);
  });

  it('falls back to FlowWorkspaceSnapshot when ref misses', () => {
    const flowId = 'subflow_b';
    const slice = makeSlice(flowId);
    const flowsRef = { current: {} };
    vi.mocked(FlowWorkspaceSnapshot.getFlowById).mockImplementation((id) =>
      id === flowId ? (slice as any) : null
    );
    expect(resolveExistingFlowSliceForSubflowOpen(flowId, flowsRef)).toBe(slice);
  });

  it('resolves alternate flow id when primary is missing', () => {
    const canonical = 'subflow_new';
    const legacy = 'subflow_old';
    const slice = makeSlice(legacy);
    const flowsRef = { current: { [legacy]: slice } };
    expect(resolveExistingFlowSliceForSubflowOpen(canonical, flowsRef, legacy)).toBe(slice);
  });
});
