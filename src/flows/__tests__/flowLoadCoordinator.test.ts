import { describe, expect, it } from 'vitest';
import {
  beginFlowLoad,
  clearFlowLoadCoordinator,
  endFlowLoad,
  fingerprintFlowLoadPayload,
  isFlowLoadInFlight,
  shouldApplyFlowLoadResult,
  markFlowLoadResultApplied,
  shouldEmitGraphHydrated,
  waitForFlowLoadIdle,
} from '../flowLoadCoordinator';

describe('flowLoadCoordinator', () => {
  it('waitForFlowLoadIdle resolves when endFlowLoad runs', async () => {
    clearFlowLoadCoordinator();
    expect(beginFlowLoad('p1', 'main', 'a')).toBe(true);
    const pending = waitForFlowLoadIdle('p1', 'main', 500);
    expect(isFlowLoadInFlight('p1', 'main')).toBe(true);
    endFlowLoad('p1', 'main', 'a');
    await pending;
    expect(isFlowLoadInFlight('p1', 'main')).toBe(false);
  });

  it('beginFlowLoad rejects concurrent callers for same key', () => {
    clearFlowLoadCoordinator();
    expect(beginFlowLoad('p1', 'main', 'a')).toBe(true);
    expect(beginFlowLoad('p1', 'main', 'b')).toBe(false);
    endFlowLoad('p1', 'main', 'a');
    expect(beginFlowLoad('p1', 'main', 'c')).toBe(true);
    endFlowLoad('p1', 'main', 'c');
  });

  it('skips identical payload when slice already hydrated with graph', () => {
    const payload = {
      nodes: [{ id: 'a', position: { x: 1, y: 2 } }],
      edges: [],
    };
    const slice = { hydrated: true, nodes: payload.nodes, edges: [] };
    expect(shouldApplyFlowLoadResult('main', payload, slice)).toBe(true);
    markFlowLoadResultApplied('main', payload);
    expect(shouldApplyFlowLoadResult('main', payload, slice)).toBe(false);
  });

  it('fingerprint changes when node position changes', () => {
    const a = fingerprintFlowLoadPayload({
      nodes: [{ id: 'a', position: { x: 0, y: 0 } }],
      edges: [],
    });
    const b = fingerprintFlowLoadPayload({
      nodes: [{ id: 'a', position: { x: 10, y: 0 } }],
      edges: [],
    });
    expect(a).not.toBe(b);
  });

  it('shouldEmitGraphHydrated fires once per fingerprint', () => {
    const payload = {
      nodes: [{ id: 'a', position: { x: 0, y: 0 } }],
      edges: [],
    };
    expect(shouldEmitGraphHydrated('main', payload)).toBe(true);
    expect(shouldEmitGraphHydrated('main', payload)).toBe(false);
  });
});
