import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import {
  computeTempNodePaneDropPosition,
  paneDropScreenAxisTolerancePx,
  targetHandleIdForTempEdge,
} from '../tempNodePaneDropPosition';
import type { FlowNode } from '../../types/flowTypes';

function makeRf(zoom: number, screenFromFlow: (p: { x: number; y: number }) => { x: number; y: number }) {
  return {
    getZoom: () => zoom,
    flowToScreenPosition(p: { x: number; y: number }) {
      return screenFromFlow(p);
    },
  };
}

describe('paneDropScreenAxisTolerancePx', () => {
  it('returns at least 40px and scales with node size in screen space', () => {
    expect(paneDropScreenAxisTolerancePx(200, 1)).toBeGreaterThanOrEqual(40);
    expect(paneDropScreenAxisTolerancePx(200, 1)).toBeLessThanOrEqual(110);
  });
});

describe('targetHandleIdForTempEdge', () => {
  it('maps opposite sides', () => {
    expect(targetHandleIdForTempEdge('bottom')).toBe('top-target');
    expect(targetHandleIdForTempEdge('right')).toBe('left-target');
  });
});

describe('computeTempNodePaneDropPosition', () => {
  const storeApi = {
    getState: () => ({ nodeInternals: new Map() }),
  } as any;

  const baseNode: Node<FlowNode> = {
    id: 'src',
    type: 'custom',
    position: { x: 100, y: 50 },
    width: 200,
    height: 80,
    data: { rows: [] } as any,
  };

  it('snaps X when mouse is in column below bottom handle (screen tolerance)', () => {
    const handleFlow = { x: 200, y: 130 };
    const rf = makeRf(1, () => ({ x: 400, y: 300 }));
    const posFlow = { x: 205, y: 200 };
    const r = computeTempNodePaneDropPosition({
      clientX: 402,
      clientY: 500,
      posFlow,
      sourceNode: baseNode,
      sourceNodeId: 'src',
      sourceHandleId: 'bottom',
      storeApi,
      reactFlowInstance: rf,
      realNodeWidth: 220,
      realNodeHeight: 80,
    });
    expect(r.verticalColumnDrop).toBe(true);
    expect(r.position.x).toBeCloseTo(handleFlow.x - 110, 5);
  });

  it('does not snap X when mouse is far sideways in screen space', () => {
    const rf = makeRf(1, () => ({ x: 400, y: 300 }));
    const posFlow = { x: 280, y: 200 };
    const r = computeTempNodePaneDropPosition({
      clientX: 520,
      clientY: 500,
      posFlow,
      sourceNode: baseNode,
      sourceNodeId: 'src',
      sourceHandleId: 'bottom',
      storeApi,
      reactFlowInstance: rf,
      realNodeWidth: 220,
      realNodeHeight: 80,
    });
    expect(r.verticalColumnDrop).toBe(false);
    expect(r.position.x).toBeCloseTo(posFlow.x - 110, 5);
  });

  it('does not snap when drop is above bottom handle in flow Y', () => {
    const rf = makeRf(1, () => ({ x: 400, y: 300 }));
    const posFlow = { x: 200, y: 40 };
    const r = computeTempNodePaneDropPosition({
      clientX: 400,
      clientY: 200,
      posFlow,
      sourceNode: baseNode,
      sourceNodeId: 'src',
      sourceHandleId: 'bottom',
      storeApi,
      reactFlowInstance: rf,
      realNodeWidth: 220,
      realNodeHeight: 80,
    });
    expect(r.verticalColumnDrop).toBe(false);
  });
});
