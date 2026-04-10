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
    serverHydrationApplied: partial.serverHydrationApplied,
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

  it('skips fetch when not hydrated but local graph is already dirty (in-memory edit not yet persisted)', () => {
    const f = flow({
      id: 'main',
      nodes: [{ id: 'n1' } as any],
      edges: [],
      hydrated: false,
      hasLocalChanges: true,
    });
    const ex = explainShouldLoadFlowFromServer('proj1', f);
    expect(ex.shouldLoad).toBe(false);
    expect(ex.reason).toBe('local_nonempty_skip_server_fetch');
  });

  it('FIX-MAIN-EMPTY: skips when hydrated with non-empty graph', () => {
    const f = flow({
      id: 'main',
      nodes: [{ id: 'n1' } as any],
      edges: [],
      hydrated: true,
      hasLocalChanges: false,
    });
    const ex = explainShouldLoadFlowFromServer('proj1', f);
    expect(ex.shouldLoad).toBe(false);
    expect(ex.reason).toBe('already_hydrated_with_graph');
  });

  it('FIX-MAIN-EMPTY: fetches when hydrated but local graph empty and server apply not yet recorded (bug recovery)', () => {
    const f = flow({
      id: 'main',
      nodes: [],
      edges: [],
      hydrated: true,
      hasLocalChanges: false,
      serverHydrationApplied: false,
    });
    const ex = explainShouldLoadFlowFromServer('proj1', f);
    expect(ex.shouldLoad).toBe(true);
    expect(ex.reason).toBe('not_hydrated_will_fetch_server');
  });

  it('FIX-MAIN-EMPTY: skips refetch when hydrated, empty, and server already applied (stable empty project)', () => {
    const f = flow({
      id: 'main',
      nodes: [],
      edges: [],
      hydrated: true,
      hasLocalChanges: false,
      serverHydrationApplied: true,
    });
    const ex = explainShouldLoadFlowFromServer('proj1', f);
    expect(ex.shouldLoad).toBe(false);
    expect(ex.reason).toBe('hydrated_empty_after_server_apply');
  });

  it('skips without real project id', () => {
    const f = flow({ id: 'main', nodes: [], edges: [], hydrated: false });
    expect(explainShouldLoadFlowFromServer(undefined, f).shouldLoad).toBe(false);
  });
});
