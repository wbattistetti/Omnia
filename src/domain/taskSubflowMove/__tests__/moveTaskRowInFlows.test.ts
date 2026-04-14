import { describe, expect, it } from 'vitest';
import { appendRowToFlowNode, moveTaskRowBetweenFlows, removeRowByIdFromFlow } from '../moveTaskRowInFlows';

describe('moveTaskRowBetweenFlows', () => {
  it('moves a row between nodes and flows', () => {
    const row = { id: 'row-1', text: 'Hello' };
    const flows = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [
          { id: 'n1', data: { rows: [row, { id: 'other' }] } },
        ],
        edges: [],
      },
      sf: {
        id: 'sf',
        title: 'Sub',
        nodes: [{ id: 'n2', data: { rows: [] } }],
        edges: [],
      },
    } as any;

    const next = moveTaskRowBetweenFlows(flows, {
      sourceFlowId: 'main',
      targetFlowId: 'sf',
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      rowId: 'row-1',
    });

    const mainRows = next.main.nodes[0].data.rows;
    const sfRows = next.sf.nodes[0].data.rows;
    expect(mainRows.some((r: any) => r.id === 'row-1')).toBe(false);
    expect(sfRows.some((r: any) => r.id === 'row-1')).toBe(true);
    expect(next.main.hasLocalChanges).toBe(true);
    expect(next.sf.hasLocalChanges).toBe(true);
  });

  it('moves a row between two nodes in the same flow (single slice)', () => {
    const row = { id: 'row-move', text: 'X' };
    const flows = {
      main: {
        id: 'main',
        nodes: [
          { id: 'a', data: { rows: [row] } },
          { id: 'b', data: { rows: [{ id: 'keep', text: 'k' }] } },
        ],
        edges: [],
      },
    } as any;

    const next = moveTaskRowBetweenFlows(flows, {
      sourceFlowId: 'main',
      targetFlowId: 'main',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      rowId: 'row-move',
    });

    const nodeA = next.main.nodes.find((n: any) => n.id === 'a');
    const nodeB = next.main.nodes.find((n: any) => n.id === 'b');
    expect(nodeA.data.rows.some((r: any) => r.id === 'row-move')).toBe(false);
    expect(nodeB.data.rows.some((r: any) => r.id === 'row-move')).toBe(true);
  });

  it('cross-flow: when target flow has no nodes yet, appends row via shell node', () => {
    const row = { id: 'r-empty-tgt', text: 'Moved' };
    const flows = {
      main: {
        id: 'main',
        nodes: [{ id: 'n1', data: { rows: [row] } }],
        edges: [],
      },
      sf: {
        id: 'sf',
        title: 'B',
        nodes: [],
        edges: [],
      },
    } as any;

    const next = moveTaskRowBetweenFlows(flows, {
      sourceFlowId: 'main',
      targetFlowId: 'sf',
      sourceNodeId: 'n1',
      targetNodeId: 'any',
      rowId: 'r-empty-tgt',
    });

    expect(next.main.nodes[0].data.rows.some((r: any) => r.id === 'r-empty-tgt')).toBe(false);
    expect(next.sf.nodes.length).toBeGreaterThan(0);
    expect(
      next.sf.nodes.some((n: any) => (n.data?.rows || []).some((r: any) => r.id === 'r-empty-tgt'))
    ).toBe(true);
  });

  it('cross-flow: when targetNodeId is missing from slice, row still lands on first node', () => {
    const row = { id: 'r-fallback', text: 'X' };
    const flows = {
      main: {
        id: 'main',
        nodes: [{ id: 'n1', data: { rows: [row] } }],
        edges: [],
      },
      sf: {
        id: 'sf',
        nodes: [{ id: 'real-node', data: { rows: [] } }],
        edges: [],
      },
    } as any;

    const next = moveTaskRowBetweenFlows(flows, {
      sourceFlowId: 'main',
      targetFlowId: 'sf',
      sourceNodeId: 'n1',
      targetNodeId: 'wrong-id',
      rowId: 'r-fallback',
    });

    const real = next.sf.nodes.find((n: any) => n.id === 'real-node');
    expect(real?.data?.rows?.some((r: any) => r.id === 'r-fallback')).toBe(true);
  });
});

describe('removeRowByIdFromFlow', () => {
  it('removes a row id from any node in the flow', () => {
    const row = { id: 'r1', text: 'x' };
    const flows = {
      main: {
        id: 'main',
        nodes: [{ id: 'a', data: { rows: [row] } }],
        edges: [],
      },
    } as any;
    const next = removeRowByIdFromFlow(flows, 'main', 'r1');
    expect(next.main.nodes[0].data.rows.length).toBe(0);
  });
});

describe('appendRowToFlowNode', () => {
  it('appends a row to the target node', () => {
    const row = { id: 'r2', text: 'appended' };
    const flows = {
      sf: {
        id: 'sf',
        nodes: [{ id: 'n2', data: { rows: [] } }],
        edges: [],
      },
    } as any;
    const next = appendRowToFlowNode(flows, { targetFlowId: 'sf', targetNodeId: 'n2', row });
    expect(next.sf.nodes[0].data.rows.some((r: any) => r.id === 'r2')).toBe(true);
  });

  it('does not append twice when the row id already exists on the target node', () => {
    const row = { id: 'r2', text: 'new' };
    const flows = {
      sf: {
        id: 'sf',
        nodes: [{ id: 'n2', data: { rows: [{ id: 'r2', text: 'old' }] } }],
        edges: [],
      },
    } as any;
    const next = appendRowToFlowNode(flows, { targetFlowId: 'sf', targetNodeId: 'n2', row });
    expect(next.sf.nodes[0].data.rows.filter((r: any) => r.id === 'r2').length).toBe(1);
    expect(next.sf.nodes[0].data.rows[0].text).toBe('old');
  });

  it('creates first canvas node when child flow has no nodes (empty subflow tab)', () => {
    const row = { id: 'moved-row', text: 'Task' };
    const flows = {
      sf: {
        id: 'sf',
        title: 'Sub',
        nodes: [],
        edges: [],
      },
    } as any;
    const next = appendRowToFlowNode(flows, { targetFlowId: 'sf', targetNodeId: '', row });
    expect(next.sf.nodes.length).toBe(1);
    expect(next.sf.nodes[0].type).toBe('custom');
    expect(next.sf.nodes[0].data.rows.some((r: any) => r.id === 'moved-row')).toBe(true);
    expect(next.sf.hasLocalChanges).toBe(true);
  });
});
