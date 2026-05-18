import { describe, expect, it } from 'vitest';
import { computeFlowPanZoomNeeded } from '../flowPanZoomCompute';

describe('flowPanZoomCompute', () => {
  const store = {
    transform: [0, 0, 1] as [number, number, number],
    width: 800,
    height: 600,
  };

  it('returns false when graph fits in viewport', () => {
    const nodes = [
      { id: 'a', position: { x: 120, y: 80 }, data: {}, width: 200, height: 100 },
      { id: 'b', position: { x: 400, y: 120 }, data: {}, width: 200, height: 100 },
    ];
    expect(computeFlowPanZoomNeeded(nodes, store, null)).toBe(false);
  });

  it('returns true when graph extends past visible flow rect', () => {
    const nodes = [{ id: 'a', position: { x: 750, y: 50 }, data: {}, width: 200, height: 80 }];
    expect(computeFlowPanZoomNeeded(nodes, store, null)).toBe(true);
  });

  it('uses RF node width/height for bounds', () => {
    const nodes = [
      { id: 'a', position: { x: 700, y: 10 }, data: {}, width: 200, height: 80 },
    ];
    expect(computeFlowPanZoomNeeded(nodes, store, null)).toBe(true);
  });
});
