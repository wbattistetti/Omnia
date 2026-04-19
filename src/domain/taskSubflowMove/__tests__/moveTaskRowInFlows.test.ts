import { describe, expect, it } from 'vitest';
import {
  appendRowToFlowNode,
  healOrphanMoveTaskRowToCanvas,
  moveTaskRowBetweenFlows,
  removeRowByIdFromFlow,
  resolveSourceNodeIdForRowMove,
} from '../moveTaskRowInFlows';

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

  it('cross-flow: creates missing target flow slice then adds shell node (main → subflow canvas id)', () => {
    const row = { id: 'r-sub', text: 'Into sub' };
    const flows = {
      main: {
        id: 'main',
        nodes: [{ id: 'n1', data: { rows: [row] } }],
        edges: [],
      },
    } as any;

    const next = moveTaskRowBetweenFlows(flows, {
      sourceFlowId: 'main',
      targetFlowId: 'subflow_portalRowXYZ',
      sourceNodeId: 'n1',
      targetNodeId: 'new-shell-node',
      rowId: 'r-sub',
      createTargetNodeIfMissing: { x: 50, y: 80 },
    });

    expect(Array.isArray(next.main.nodes) ? next.main.nodes.length : 0).toBe(0);
    expect(next.subflow_portalRowXYZ).toBeDefined();
    expect(next.subflow_portalRowXYZ.nodes.length).toBe(1);
    expect(next.subflow_portalRowXYZ.nodes[0].id).toBe('new-shell-node');
    expect(next.subflow_portalRowXYZ.nodes[0].data.rows[0].id).toBe('r-sub');
  });

  it('cross-flow: respects targetRowInsertIndex (insert before existing rows)', () => {
    const row = { id: 'mv', text: 'moved' };
    const flows = {
      main: {
        id: 'main',
        nodes: [{ id: 'n1', data: { rows: [row] } }],
        edges: [],
      },
      sf: {
        id: 'sf',
        nodes: [
          {
            id: 'n2',
            data: {
              rows: [
                { id: 'e1', text: 'first' },
                { id: 'e2', text: 'second' },
              ],
            },
          },
        ],
        edges: [],
      },
    } as any;

    const next = moveTaskRowBetweenFlows(flows, {
      sourceFlowId: 'main',
      targetFlowId: 'sf',
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      rowId: 'mv',
      targetRowInsertIndex: 0,
    });

    const rows = next.sf.nodes[0].data.rows as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(['mv', 'e1', 'e2']);
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

    expect(next.main.nodes.some((n: any) => n.id === 'a')).toBe(false);
    const nodeB = next.main.nodes.find((n: any) => n.id === 'b');
    expect(nodeB.data.rows.some((r: any) => r.id === 'row-move')).toBe(true);
  });

  it('same-flow: respects targetRowInsertIndex on destination node', () => {
    const row = { id: 'mv', text: 'moved' };
    const flows = {
      main: {
        id: 'main',
        nodes: [
          { id: 'a', data: { rows: [row] } },
          {
            id: 'b',
            data: {
              rows: [
                { id: 'x1', text: 'a' },
                { id: 'x2', text: 'b' },
              ],
            },
          },
        ],
        edges: [],
      },
    } as any;

    const next = moveTaskRowBetweenFlows(flows, {
      sourceFlowId: 'main',
      targetFlowId: 'main',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      rowId: 'mv',
      targetRowInsertIndex: 1,
    });

    expect(next.main.nodes.some((n: any) => n.id === 'a')).toBe(false);
    const nodeB = next.main.nodes.find((n: any) => n.id === 'b');
    expect((nodeB.data.rows as { id: string }[]).map((r) => r.id)).toEqual(['x1', 'mv', 'x2']);
  });

  it('same-flow: removes incident edges when the emptied source node is pruned', () => {
    const row = { id: 'solo', text: 'X' };
    const flows = {
      main: {
        nodes: [
          { id: 'a', data: { rows: [row] } },
          { id: 'b', data: { rows: [{ id: 'keep', text: 'k' }] } },
        ],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      },
    } as any;

    const next = moveTaskRowBetweenFlows(flows, {
      sourceFlowId: 'main',
      targetFlowId: 'main',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      rowId: 'solo',
    });

    expect(next.main.nodes.some((n: any) => n.id === 'a')).toBe(false);
    expect(next.main.edges.length).toBe(0);
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

    expect(next.main.nodes.length).toBe(0);
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

    expect(next.main.nodes.length).toBe(0);
    const real = next.sf.nodes.find((n: any) => n.id === 'real-node');
    expect(real?.data?.rows?.some((r: any) => r.id === 'r-fallback')).toBe(true);
  });

  it('same flow: creates target shell when targetNodeId is new and createTargetNodeIfMissing is set', () => {
    const row = { id: 'r-move', text: 'Hi' };
    const flows = {
      main: {
        id: 'main',
        nodes: [
          { id: 'source', type: 'custom', position: { x: 0, y: 0 }, data: { rows: [row] } },
        ],
        edges: [],
      },
    } as any;

    const next = moveTaskRowBetweenFlows(flows, {
      sourceFlowId: 'main',
      targetFlowId: 'main',
      sourceNodeId: 'source',
      targetNodeId: 'brand-new-node',
      rowId: 'r-move',
      createTargetNodeIfMissing: { x: 400, y: 200 },
    });

    expect(next.main.nodes.some((n: any) => n.id === 'source')).toBe(false);
    const created = next.main.nodes.find((n: any) => n.id === 'brand-new-node');
    expect(created?.position).toEqual({ x: 400, y: 200 });
    expect(created?.data?.rows?.[0]?.id).toBe('r-move');
  });
});

describe('resolveSourceNodeIdForRowMove', () => {
  it('returns preferred node id when that node holds the row', () => {
    const flows = {
      main: {
        nodes: [
          { id: 'a', data: { rows: [{ id: 'r1' }] } },
          { id: 'b', data: { rows: [{ id: 'r2' }] } },
        ],
      },
    } as any;
    expect(resolveSourceNodeIdForRowMove(flows, 'main', 'r1', 'a')).toBe('a');
  });

  it('returns the node that contains the row when preferred id is stale', () => {
    const flows = {
      main: {
        nodes: [
          { id: 'wrong', data: { rows: [] } },
          { id: 'good', data: { rows: [{ id: 'r1', text: 'x' }] } },
        ],
      },
    } as any;
    expect(resolveSourceNodeIdForRowMove(flows, 'main', 'r1', 'wrong')).toBe('good');
  });

  it('returns null when the row is not on the flow', () => {
    const flows = {
      main: {
        nodes: [{ id: 'a', data: { rows: [{ id: 'other' }] } }],
      },
    } as any;
    expect(resolveSourceNodeIdForRowMove(flows, 'main', 'missing', 'a')).toBe(null);
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

describe('healOrphanMoveTaskRowToCanvas', () => {
  it('lands on child and strips parent when move used a wrong preferred source node but row stayed on parent', () => {
    const row = { id: 't1', text: 'x' };
    const flowsBefore = {
      main: {
        nodes: [
          { id: 'wrong-pref', data: { rows: [] } },
          { id: 'real', data: { rows: [row] } },
        ],
      },
    } as any;
    const flowsAfter = {
      main: {
        nodes: [
          { id: 'wrong-pref', data: { rows: [] } },
          { id: 'real', data: { rows: [row] } },
        ],
      },
      subflow_sf: {
        id: 'subflow_sf',
        nodes: [],
        edges: [],
      },
    } as any;

    const healed = healOrphanMoveTaskRowToCanvas({
      flowsBeforeMove: flowsBefore,
      flowsAfterMove: flowsAfter,
      sourceFlowId: 'main',
      sourceNodeId: 'wrong-pref',
      targetFlowId: 'subflow_sf',
      rowId: 't1',
      newNodeId: 'shell',
      position: { x: 5, y: 5 },
    });

    const stillOnMain = healed.main.nodes.some((n: any) =>
      (n.data?.rows ?? []).some((r: any) => r.id === 't1')
    );
    expect(stillOnMain).toBe(false);
    expect(
      healed.subflow_sf.nodes.some((n: any) =>
        (n.data?.rows ?? []).some((r: any) => r.id === 't1')
      )
    ).toBe(true);
  });

  it('materializes the shell node when the row vanished from both canvases (orphan extract)', () => {
    const row = { id: 'orph-task', text: 'lost' };
    const flowsBefore = {
      main: {
        id: 'main',
        nodes: [{ id: 'n-src', data: { rows: [row] } }],
        edges: [],
      },
    } as any;
    const flowsAfterOrphan = {
      main: {
        id: 'main',
        nodes: [],
        edges: [],
      },
      subflow_x: {
        id: 'subflow_x',
        nodes: [],
        edges: [],
      },
    } as any;

    const healed = healOrphanMoveTaskRowToCanvas({
      flowsBeforeMove: flowsBefore,
      flowsAfterMove: flowsAfterOrphan,
      sourceFlowId: 'main',
      sourceNodeId: 'n-src',
      targetFlowId: 'subflow_x',
      rowId: 'orph-task',
      newNodeId: 'shell-1',
      position: { x: 10, y: 20 },
    });

    expect(healed.subflow_x.nodes.length).toBe(1);
    expect(healed.subflow_x.nodes[0].id).toBe('shell-1');
    expect(healed.subflow_x.nodes[0].position).toEqual({ x: 10, y: 20 });
    expect(healed.subflow_x.nodes[0].data.rows[0].id).toBe('orph-task');
  });

  it('returns unchanged when child already holds the row', () => {
    const row = { id: 'ok', text: 'x' };
    const flowsBefore = {
      main: { nodes: [{ id: 'n1', data: { rows: [row] } }] },
    } as any;
    const flowsAfter = {
      main: { nodes: [] },
      sf: { nodes: [{ id: 'n2', data: { rows: [row] } }] },
    } as any;
    const out = healOrphanMoveTaskRowToCanvas({
      flowsBeforeMove: flowsBefore,
      flowsAfterMove: flowsAfter,
      sourceFlowId: 'main',
      sourceNodeId: 'n1',
      targetFlowId: 'sf',
      rowId: 'ok',
      newNodeId: 'shell',
      position: { x: 0, y: 0 },
    });
    expect(out).toBe(flowsAfter);
  });
});
