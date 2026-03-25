import { describe, expect, it, vi } from 'vitest';
import { nearestDockRegionForPoint } from '../useFlowInterfaceDockDrag';

describe('nearestDockRegionForPoint', () => {
  it('returns top when closest to top edge', () => {
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);
    expect(nearestDockRegionForPoint(400, 50)).toBe('top');
  });

  it('returns bottom when closest to bottom edge', () => {
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);
    expect(nearestDockRegionForPoint(400, 580)).toBe('bottom');
  });

  it('returns left when closest to left edge', () => {
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);
    expect(nearestDockRegionForPoint(30, 300)).toBe('left');
  });

  it('returns right when closest to right edge', () => {
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);
    expect(nearestDockRegionForPoint(780, 300)).toBe('right');
  });

  it('uses flow bounds inset when provided (not full window)', () => {
    const bounds = new DOMRect(200, 100, 400, 500);
    expect(nearestDockRegionForPoint(210, 110, bounds)).toBe('top');
    expect(nearestDockRegionForPoint(400, 598, bounds)).toBe('bottom');
    expect(nearestDockRegionForPoint(205, 300, bounds)).toBe('left');
    expect(nearestDockRegionForPoint(590, 300, bounds)).toBe('right');
  });
});
