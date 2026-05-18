import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TOOLBAR_DRAG_THRESHOLD_PX } from '../flowToolbarNodeDrag';

describe('flowToolbarNodeDrag', () => {
  it('exports a movement threshold for activation', () => {
    expect(TOOLBAR_DRAG_THRESHOLD_PX).toBeGreaterThanOrEqual(4);
  });
});

describe('toolbar drag activation threshold logic', () => {
  const pointer = { clientX: 100, clientY: 100 };

  function shouldActivate(clientX: number, clientY: number): boolean {
    const dx = pointer.clientX - clientX;
    const dy = pointer.clientY - clientY;
    return Math.hypot(dx, dy) >= TOOLBAR_DRAG_THRESHOLD_PX;
  }

  it('does not activate below threshold', () => {
    expect(shouldActivate(103, 101)).toBe(false);
  });

  it('activates at or beyond threshold', () => {
    expect(shouldActivate(100 + TOOLBAR_DRAG_THRESHOLD_PX, 100)).toBe(true);
  });
});
