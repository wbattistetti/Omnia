import { describe, expect, it } from 'vitest';
import {
  mergeDockInboundLayoutOnly,
  mergeDockInboundWithAuthoritativeDocFields,
  shouldSkipDockInboundBareEmptySlice,
  shouldSkipDockInboundEmptySubflowGraph,
} from '../dockInboundFlowSlicePolicy';

describe('shouldSkipDockInboundEmptySubflowGraph', () => {
  it('skips when subflow would be cleared to empty but current has nodes', () => {
    expect(
      shouldSkipDockInboundEmptySubflowGraph({
        flowId: 'subflow_abc',
        incomingNodes: [],
        currentNodes: [{ id: 'n1' }],
      })
    ).toBe(true);
  });

  it('does not skip for main', () => {
    expect(
      shouldSkipDockInboundEmptySubflowGraph({
        flowId: 'main',
        incomingNodes: [],
        currentNodes: [{ id: 'n1' }],
      })
    ).toBe(false);
  });

  it('does not skip when incoming has nodes', () => {
    expect(
      shouldSkipDockInboundEmptySubflowGraph({
        flowId: 'subflow_abc',
        incomingNodes: [{ id: 'n1' }],
        currentNodes: [{ id: 'n0' }],
      })
    ).toBe(false);
  });
});

describe('shouldSkipDockInboundBareEmptySlice', () => {
  it('skips empty nodes array', () => {
    expect(shouldSkipDockInboundBareEmptySlice({ nodes: [] })).toBe(true);
  });

  it('skips when emptyNodesExplicit', () => {
    expect(shouldSkipDockInboundBareEmptySlice({ nodes: [], emptyNodesExplicit: true })).toBe(true);
  });

  it('does not skip when slice has nodes', () => {
    expect(shouldSkipDockInboundBareEmptySlice({ nodes: [{ id: 'n1' }] })).toBe(false);
  });
});

describe('mergeDockInboundLayoutOnly', () => {
  it('keeps node data and meta from current; position from incoming', () => {
    const current = {
      meta: { translations: { 'var:x': 'L' } },
      nodes: [
        {
          id: 'a',
          position: { x: 0, y: 0 },
          data: { rows: [{ id: 'r1', text: 'Keep' }] },
        },
      ],
      edges: [{ id: 'e1' }],
    };
    const incoming = {
      nodes: [
        {
          id: 'a',
          position: { x: 99, y: 50 },
          data: { rows: [{ id: 'r1', text: 'StalefromDock' }] },
        },
      ],
      edges: [],
    };
    const out = mergeDockInboundLayoutOnly(incoming, current as any);
    expect(out.meta).toEqual(current.meta);
    expect((out.nodes[0] as any).position).toEqual({ x: 99, y: 50 });
    expect((out.nodes[0] as any).data.rows[0].text).toBe('Keep');
    expect(out.edges).toEqual(current.edges);
  });
});

describe('mergeDockInboundWithAuthoritativeDocFields', () => {
  it('preserves meta from current slice', () => {
    const cur = {
      meta: { translations: { 'var:x': 'L' }, flowInterface: {} },
      tasks: { a: 1 },
    };
    const inc = {
      nodes: [{ id: 'n2' }],
      edges: [],
      meta: { translations: { 'var:y': 'Stale' } },
      tasks: undefined,
    };
    const out = mergeDockInboundWithAuthoritativeDocFields(inc, cur as any);
    expect(out.meta).toEqual(cur.meta);
    expect(out.nodes).toEqual(inc.nodes);
    expect(out.tasks).toEqual(cur.tasks);
  });

  it('passes through when no current', () => {
    const inc = { id: 'main', nodes: [] };
    expect(mergeDockInboundWithAuthoritativeDocFields(inc, undefined)).toBe(inc);
  });
});
