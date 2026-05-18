import { describe, expect, it } from 'vitest';
import {
  isFinitePosition,
  isReactFlowViewportReady,
  nodesHaveFinitePositions,
} from '../flowPositionGuards';

describe('flowPositionGuards', () => {
  it('rejects NaN positions', () => {
    expect(isFinitePosition({ x: 1, y: 2 })).toBe(true);
    expect(isFinitePosition({ x: NaN, y: 0 })).toBe(false);
    expect(isFinitePosition(undefined)).toBe(false);
  });

  it('nodesHaveFinitePositions', () => {
    expect(nodesHaveFinitePositions([{ id: 'a', position: { x: 0, y: 0 }, data: {} }])).toBe(true);
    expect(
      nodesHaveFinitePositions([{ id: 'a', position: { x: NaN, y: 0 }, data: {} } as any])
    ).toBe(false);
  });

  it('isReactFlowViewportReady', () => {
    expect(isReactFlowViewportReady(800, 600, [0, 0, 1])).toBe(true);
    expect(isReactFlowViewportReady(0, 600, [0, 0, 1])).toBe(false);
    expect(isReactFlowViewportReady(800, 600, [0, 0, NaN])).toBe(false);
    expect(isReactFlowViewportReady(800, 600, [0, 0, 0])).toBe(false);
  });
});
