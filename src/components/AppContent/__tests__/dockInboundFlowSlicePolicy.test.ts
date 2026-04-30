import { describe, expect, it } from 'vitest';
import {
  mergeDockInboundLayoutOnly,
  mergeDockInboundWithAuthoritativeDocFields,
  mergeInboundFlowMeta,
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

  it('merges incoming meta.translations into current (flow label write / writeTranslationToFlowSlice)', () => {
    const current = {
      id: 'main',
      meta: { translations: { 'task:aaa': 'keep-me', 'task:bbb': 'old' } },
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { rows: [] } }],
      edges: [],
    };
    const incoming = {
      id: 'main',
      meta: { translations: { 'task:bbb': 'Salve-encoded', 'task:ccc': 'new' } },
      nodes: [{ id: 'a', position: { x: 5, y: 5 }, data: { rows: [] } }],
      edges: [],
    };
    const out = mergeDockInboundLayoutOnly(incoming, current as any);
    expect(out.meta?.translations).toEqual({
      'task:aaa': 'keep-me',
      'task:bbb': 'Salve-encoded',
      'task:ccc': 'new',
    });
  });
});

describe('mergeInboundFlowMeta', () => {
  it('returns current when incoming has no translations', () => {
    const cur = { translations: { 'task:x': 'a' } };
    expect(mergeInboundFlowMeta(cur, undefined)).toBe(cur);
    expect(mergeInboundFlowMeta(cur, {})).toBe(cur);
  });

  it('merges translation keys from incoming onto current', () => {
    const out = mergeInboundFlowMeta(
      { translations: { 'task:a': '1' }, flowInterface: { input: [], output: [] } },
      { translations: { 'task:a': '2', 'task:b': '3' } }
    );
    expect(out?.translations).toEqual({ 'task:a': '2', 'task:b': '3' });
    expect(out?.flowInterface).toEqual({ input: [], output: [] });
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
