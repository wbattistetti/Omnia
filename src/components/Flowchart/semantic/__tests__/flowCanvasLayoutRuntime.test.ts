import { describe, expect, it, vi } from 'vitest';
import {
  applyNodeLayoutRuntime,
  mergeNodesWithMeasuredLayout,
} from '../flowCanvasLayoutRuntime';

describe('flowCanvasLayoutRuntime', () => {
  it('mergeNodesWithMeasuredLayout applies width/height without mutating store nodes', () => {
    const layout = new Map([['n1', { width: 200, height: 80 }]]);
    const nodes = [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }];
    const merged = mergeNodesWithMeasuredLayout(nodes, layout);
    expect(merged[0].width).toBe(200);
    expect(merged[0].height).toBe(80);
    expect(nodes[0].width).toBeUndefined();
  });

  it('applyNodeLayoutRuntime skips sub-epsilon churn', () => {
    const layout = new Map<string, { width: number; height: number }>();
    const update = vi.fn();
    expect(
      applyNodeLayoutRuntime({
        nodeId: 'n1',
        width: 100,
        height: 50,
        layoutById: layout,
        updateNodeInternals: update,
      })
    ).toBe(true);
    expect(
      applyNodeLayoutRuntime({
        nodeId: 'n1',
        width: 101,
        height: 51,
        layoutById: layout,
        updateNodeInternals: update,
      })
    ).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
