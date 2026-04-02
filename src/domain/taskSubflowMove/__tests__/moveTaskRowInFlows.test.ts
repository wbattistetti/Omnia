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
});
