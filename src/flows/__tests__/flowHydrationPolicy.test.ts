import { describe, expect, it } from 'vitest';
import { explainShouldLoadFlowFromServer, shouldLoadFlowFromServer } from '../flowHydrationPolicy';
import type { Flow } from '../FlowTypes';

function flow(partial: Partial<Flow> & Pick<Flow, 'id'>): Flow {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    nodes: partial.nodes ?? [],
    edges: partial.edges ?? [],
    hydrated: partial.hydrated,
    hasLocalChanges: partial.hasLocalChanges,
  };
}

describe('flowHydrationPolicy', () => {
  it('explain and shouldLoad agree: fetch when not hydrated (empty canvas)', () => {
    const f = flow({ id: 'main', nodes: [], edges: [], hydrated: false, hasLocalChanges: false });
    const ex = explainShouldLoadFlowFromServer('proj1', f);
    expect(ex.shouldLoad).toBe(true);
    expect(ex.reason).toBe('not_hydrated_will_fetch_server');
    expect(shouldLoadFlowFromServer('proj1', f)).toBe(ex.shouldLoad);
  });

  it('still fetches when not hydrated even if local graph or flags look dirty (server wins until hydrated)', () => {
    const f = flow({
      id: 'main',
      nodes: [{ id: 'n1' } as any],
      edges: [],
      hydrated: false,
      hasLocalChanges: true,
    });
    const ex = explainShouldLoadFlowFromServer('proj1', f);
    expect(ex.shouldLoad).toBe(true);
    expect(ex.reason).toBe('not_hydrated_will_fetch_server');
  });

  it('skips when hydrated', () => {
    const f = flow({ id: 'main', nodes: [], edges: [], hydrated: true, hasLocalChanges: false });
    expect(explainShouldLoadFlowFromServer('proj1', f).shouldLoad).toBe(false);
    expect(explainShouldLoadFlowFromServer('proj1', f).reason).toBe('already_hydrated');
  });

  it('skips without real project id', () => {
    const f = flow({ id: 'main', nodes: [], edges: [], hydrated: false });
    expect(explainShouldLoadFlowFromServer(undefined, f).shouldLoad).toBe(false);
  });
});
