import { describe, expect, it } from 'vitest';
import {
  computeNodeFlowRect,
  hasAnyNodeOutsideFlowRect,
  isFlowRectFullyInside,
  visibleFlowRectFromViewportStore,
} from '../flowGraphBounds';

describe('flowGraphBounds', () => {
  it('detects node outside visible rect', () => {
    const visible = { minX: 0, minY: 0, maxX: 500, maxY: 400 };
    const nodes = [{ id: 'a', position: { x: 600, y: 50 }, data: {} }];
    expect(hasAnyNodeOutsideFlowRect(nodes, visible)).toBe(true);
  });

  it('returns false when all nodes fit', () => {
    const visible = { minX: 0, minY: 0, maxX: 900, maxY: 900 };
    const nodes = [{ id: 'a', position: { x: 100, y: 80 }, data: {} }];
    expect(hasAnyNodeOutsideFlowRect(nodes, visible)).toBe(false);
  });

  it('visibleFlowRectFromViewportStore matches centered graph in view', () => {
    const visible = visibleFlowRectFromViewportStore({ x: 0, y: 0, zoom: 1 }, 800, 600);
    expect(visible?.minX).toBeCloseTo(0);
    expect(visible?.minY).toBeCloseTo(0);
    expect(visible?.maxX).toBe(800);
    expect(visible?.maxY).toBe(600);
    const nodes = [
      { id: 'a', position: { x: 120, y: 80 }, data: {}, width: 200, height: 100 },
      { id: 'b', position: { x: 400, y: 120 }, data: {}, width: 200, height: 100 },
    ];
    expect(hasAnyNodeOutsideFlowRect(nodes, visible!)).toBe(false);
  });

  it('isFlowRectFullyInside respects tolerance', () => {
    const outer = { minX: 0, minY: 0, maxX: 400, maxY: 400 };
    const inner = computeNodeFlowRect({
      id: 'n',
      position: { x: 10, y: 10 },
      data: {},
      width: 120,
      height: 60,
    });
    expect(isFlowRectFullyInside(inner, outer)).toBe(true);
  });
});
