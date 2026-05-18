import { describe, expect, it } from 'vitest';
import { computeFlowCanvasContentBounds } from '../flowCanvasContentBounds';

describe('computeFlowCanvasContentBounds', () => {
  it('uses minimum size when graph is empty', () => {
    const b = computeFlowCanvasContentBounds([], { minWidth: 1200, minHeight: 800, padding: 200 });
    expect(b).toEqual({ width: 1200, height: 800, viewportX: 200, viewportY: 200 });
  });

  it('expands to node bounding box plus padding', () => {
    const b = computeFlowCanvasContentBounds(
      [
        { id: 'a', position: { x: 100, y: 50 }, data: { rows: [{}, {}] } },
        { id: 'b', position: { x: 500, y: 300 }, data: {} },
      ],
      { padding: 100, minWidth: 400, minHeight: 400, nodeWidth: 280 }
    );
    expect(b.width).toBeGreaterThanOrEqual(500 + 280 - 100 + 200);
    expect(b.height).toBeGreaterThanOrEqual(400);
    expect(b.viewportX).toBe(100 - 100);
    expect(b.viewportY).toBe(100 - 50);
  });
});
