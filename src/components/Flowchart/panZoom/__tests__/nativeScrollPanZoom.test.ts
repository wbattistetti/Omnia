import { describe, expect, it } from 'vitest';
import {
  hasAnyNodeOutsideNativeScroll,
  isNativeScrollOverflow,
  visibleFlowRectFromNativeScroll,
} from '../nativeScrollPanZoom';

describe('nativeScrollPanZoom', () => {
  it('detects scroll overflow on host', () => {
    const host = {
      scrollWidth: 2000,
      clientWidth: 800,
      scrollHeight: 900,
      clientHeight: 900,
    } as HTMLElement;
    expect(isNativeScrollOverflow(host)).toBe(true);
  });

  it('maps scroll position to visible flow rect', () => {
    const host = {
      scrollLeft: 100,
      scrollTop: 50,
      clientWidth: 800,
      clientHeight: 600,
    } as HTMLElement;
    const visible = visibleFlowRectFromNativeScroll(host, { x: 200, y: 150, zoom: 1 });
    expect(visible.minX).toBe(100 - 200);
    expect(visible.minY).toBe(50 - 150);
    expect(visible.maxX).toBe(100 + 800 - 200);
    expect(visible.maxY).toBe(50 + 600 - 150);
  });

  it('detects node outside scrolled viewport in flow space', () => {
    const host = {
      scrollLeft: 0,
      scrollTop: 0,
      clientWidth: 400,
      clientHeight: 300,
    } as HTMLElement;
    const nodes = [{ id: 'far', position: { x: 2000, y: 2000 }, data: {} }];
    expect(hasAnyNodeOutsideNativeScroll(nodes, host, { x: 0, y: 0, zoom: 1 })).toBe(true);
  });
});
