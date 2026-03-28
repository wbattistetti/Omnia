import { describe, it, expect } from 'vitest';
import { dropPlacementFromEvent } from '../useSidebarDropIndicator';

describe('dropPlacementFromEvent', () => {
  it('returns before when pointer is in the upper half of the row', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({ top: 100, height: 40, left: 0, width: 100, bottom: 140, right: 100, x: 0, y: 100, toJSON: () => ({}) } as DOMRect);
    const e = { clientY: 110 } as unknown as React.DragEvent;
    expect(dropPlacementFromEvent(e, el)).toBe('before');
  });

  it('returns after when pointer is in the lower half of the row', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({ top: 100, height: 40, left: 0, width: 100, bottom: 140, right: 100, x: 0, y: 100, toJSON: () => ({}) } as DOMRect);
    const e = { clientY: 125 } as unknown as React.DragEvent;
    expect(dropPlacementFromEvent(e, el)).toBe('after');
  });
});
