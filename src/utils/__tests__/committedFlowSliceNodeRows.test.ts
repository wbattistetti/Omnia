import { describe, expect, it } from 'vitest';
import {
  committedSliceContainsTaskRowOnNode,
  findNodeIdInSliceOwningTaskRow,
  cloneRowsForReactSync,
  scheduleCommittedFlowNodeRowsSync,
  COMMITTED_FLOW_NODE_ROWS_SYNC_EVENT,
} from '../committedFlowSliceNodeRows';

describe('findNodeIdInSliceOwningTaskRow', () => {
  it('returns the node id that contains the row, not an arbitrary hint', () => {
    const flows = {
      main: {
        nodes: [
          { id: 'dnd-target-hint', data: { rows: [] } },
          { id: 'real-rf-node', data: { rows: [{ id: 'task-row' }] } },
        ],
        edges: [],
      },
    };
    expect(findNodeIdInSliceOwningTaskRow(flows as any, 'main', 'task-row')).toBe('real-rf-node');
  });
});

describe('committedSliceContainsTaskRowOnNode', () => {
  it('returns true when row id is present on node', () => {
    const flows = {
      main: {
        id: 'main',
        nodes: [{ id: 'n1', data: { rows: [{ id: 'task-a', text: 'x' }] } }],
        edges: [],
      },
    };
    expect(committedSliceContainsTaskRowOnNode(flows as any, 'main', 'n1', 'task-a')).toBe(true);
  });

  it('returns false when row missing', () => {
    const flows = {
      main: {
        id: 'main',
        nodes: [{ id: 'n1', data: { rows: [{ id: 'other' }] } }],
        edges: [],
      },
    };
    expect(committedSliceContainsTaskRowOnNode(flows as any, 'main', 'n1', 'task-a')).toBe(false);
  });
});

describe('cloneRowsForReactSync', () => {
  it('copies row objects shallowly', () => {
    const a = { id: '1', nested: { x: 1 } };
    const out = cloneRowsForReactSync([a]);
    expect(out[0]).not.toBe(a);
    expect(out[0].nested).toBe(a.nested);
  });
});

describe('scheduleCommittedFlowNodeRowsSync', () => {
  it('dispatches event when slice is valid', async () => {
    const flows = {
      main: {
        id: 'main',
        nodes: [{ id: 'n1', data: { rows: [{ id: 'task-a' }] } }],
        edges: [],
      },
    };
    let received: unknown;
    const fn = (e: Event) => {
      received = (e as CustomEvent).detail;
    };
    window.addEventListener(COMMITTED_FLOW_NODE_ROWS_SYNC_EVENT, fn);
    const ok = scheduleCommittedFlowNodeRowsSync(flows as any, 'main', 'task-a');
    expect(ok).toBe(true);
    await new Promise((r) => queueMicrotask(r));
    await new Promise((r) => requestAnimationFrame(r));
    window.removeEventListener(COMMITTED_FLOW_NODE_ROWS_SYNC_EVENT, fn);
    expect(received).toMatchObject({
      flowCanvasId: 'main',
      nodeId: 'n1',
      rowId: 'task-a',
      rows: [{ id: 'task-a' }],
    });
  });

  it('does not dispatch when row missing', async () => {
    let count = 0;
    const fn = () => {
      count += 1;
    };
    window.addEventListener(COMMITTED_FLOW_NODE_ROWS_SYNC_EVENT, fn);
    const ok = scheduleCommittedFlowNodeRowsSync({ main: { nodes: [], edges: [] } } as any, 'main', 'x');
    expect(ok).toBe(false);
    await new Promise((r) => queueMicrotask(r));
    await new Promise((r) => requestAnimationFrame(r));
    window.removeEventListener(COMMITTED_FLOW_NODE_ROWS_SYNC_EVENT, fn);
    expect(count).toBe(0);
  });
});
