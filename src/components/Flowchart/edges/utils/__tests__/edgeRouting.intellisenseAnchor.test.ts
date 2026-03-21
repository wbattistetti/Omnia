import { describe, it, expect } from 'vitest';
import { intellisenseAnchorFlowFromHandles, VHV_COLLINEAR_EPS_PX } from '../edgeRouting';

describe('intellisenseAnchorFlowFromHandles', () => {
  it('uses source X and vertical midpoint when handles are collinear in X', () => {
    const sx = 100;
    const tx = 100 + VHV_COLLINEAR_EPS_PX;
    const anchor = intellisenseAnchorFlowFromHandles(sx, 50, tx, 150);
    expect(anchor.x).toBe(sx);
    expect(anchor.y).toBe(100);
  });

  it('uses VHV midpoint on horizontal leg when X delta exceeds epsilon', () => {
    const anchor = intellisenseAnchorFlowFromHandles(0, 0, 100, 200);
    expect(anchor.x).toBe(50);
    expect(anchor.y).toBe(100);
  });
});
