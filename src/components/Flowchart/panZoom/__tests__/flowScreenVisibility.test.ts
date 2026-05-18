import { describe, expect, it } from 'vitest';
import { hasAnyNodeOutsideScreenPane } from '../flowScreenVisibility';

describe('flowScreenVisibility', () => {
  const pane = { left: 100, top: 50, width: 400, height: 350 };
  const viewport = { x: 0, y: 0, zoom: 1 };

  it('detects node extending past right edge of pane', () => {
    const nodes = [{ id: 'a', position: { x: 350, y: 10 }, data: {}, width: 280, height: 80 }];
    expect(hasAnyNodeOutsideScreenPane(nodes, viewport, pane)).toBe(true);
  });

  it('returns false when node fits in pane', () => {
    const nodes = [{ id: 'a', position: { x: 50, y: 10 }, data: {}, width: 120, height: 80 }];
    expect(hasAnyNodeOutsideScreenPane(nodes, viewport, pane)).toBe(false);
  });
});
