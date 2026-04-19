import { describe, expect, it } from 'vitest';
import { reduceUpsertFlow } from '../workspaceTransitions';
import type { Flow, WorkspaceState } from '../FlowTypes';

function makeState(main: Flow): WorkspaceState {
  return {
    flows: { main },
    openFlows: ['main'],
    activeFlowId: 'main',
  };
}

describe('reduceUpsertFlow', () => {
  it('preserves local row text when opts allow (legacy merge)', () => {
    const prev = makeState({
      id: 'main',
      title: 'Main',
      nodes: [
        {
          id: 'n1',
          data: {
            rows: [{ id: 'r1', text: 'LOCAL_LABEL' }],
          },
        },
      ] as any,
      edges: [],
      hasLocalChanges: true,
    });
    const incoming = {
      id: 'main',
      title: 'Main',
      nodes: [
        {
          id: 'n1',
          data: {
            rows: [{ id: 'r1', text: 'SERVER_LABEL' }],
          },
        },
      ],
      edges: [],
    } as Flow;
    const next = reduceUpsertFlow(prev, incoming, { preserveLocalRowTextOnUpsert: true });
    const row = (next.flows.main.nodes[0] as any).data.rows[0];
    expect(row.text).toBe('LOCAL_LABEL');
  });

  it('uses incoming row text when preserveLocalRowTextOnUpsert is false', () => {
    const prev = makeState({
      id: 'main',
      title: 'Main',
      nodes: [
        {
          id: 'n1',
          data: {
            rows: [{ id: 'r1', text: 'LOCAL_LABEL' }],
          },
        },
      ] as any,
      edges: [],
      hasLocalChanges: true,
    });
    const incoming = {
      id: 'main',
      title: 'Main',
      nodes: [
        {
          id: 'n1',
          data: {
            rows: [{ id: 'r1', text: 'SERVER_LABEL' }],
          },
        },
      ],
      edges: [],
    } as Flow;
    const next = reduceUpsertFlow(prev, incoming, { preserveLocalRowTextOnUpsert: false });
    const row = (next.flows.main.nodes[0] as any).data.rows[0];
    expect(row.text).toBe('SERVER_LABEL');
  });

  it('preserves local-only meta.translations keys when inbound upsert omits them (Dock stale snapshot)', () => {
    const vid = 'var:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const prev = makeState({
      id: 'main',
      title: 'Main',
      nodes: [],
      edges: [],
      meta: {
        translations: {
          [vid]: 'Nuovo nome',
        },
      } as any,
      hasLocalChanges: true,
    });
    const incoming = {
      id: 'main',
      title: 'Main',
      nodes: [],
      edges: [],
      meta: {
        translations: {},
      } as any,
    } as Flow;
    const next = reduceUpsertFlow(prev, incoming);
    expect(next.flows.main.meta?.translations?.[vid]).toBe('Nuovo nome');
  });
});
