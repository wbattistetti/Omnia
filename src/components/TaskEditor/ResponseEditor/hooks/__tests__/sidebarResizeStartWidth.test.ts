import { describe, it, expect } from 'vitest';
import { getSidebarResizeStartWidthPx } from '@responseEditor/hooks/sidebarResizeStartWidth';
import { SIDEBAR_CONTENT_MIN_WIDTH_PX } from '@responseEditor/Sidebar/sidebarLayoutConstants';

describe('getSidebarResizeStartWidthPx', () => {
  it('prefers measured DOM width when positive', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({
        width: 301,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(
      getSidebarResizeStartWidthPx({
        sidebarManualWidth: 400,
        sidebarElement: el,
      })
    ).toBe(301);
  });

  it('falls back to sidebarManualWidth when ref is missing', () => {
    expect(
      getSidebarResizeStartWidthPx({
        sidebarManualWidth: 320,
        sidebarElement: undefined,
      })
    ).toBe(320);
  });

  it('falls back to layout constant when DOM width is invalid and manual is null', () => {
    expect(
      getSidebarResizeStartWidthPx({
        sidebarManualWidth: null,
        sidebarElement: undefined,
      })
    ).toBe(SIDEBAR_CONTENT_MIN_WIDTH_PX);
  });
});
