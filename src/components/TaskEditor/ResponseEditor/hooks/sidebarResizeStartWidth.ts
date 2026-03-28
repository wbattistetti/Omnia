/**
 * Resolves the sidebar track width at drag start without failing when the sidebar
 * DOM ref is not yet attached (same idea as right-panel splitters: state + fallback).
 */

import { SIDEBAR_CONTENT_MIN_WIDTH_PX } from '@responseEditor/Sidebar/sidebarLayoutConstants';

export function getSidebarResizeStartWidthPx(options: {
  sidebarManualWidth: number | null | undefined;
  sidebarElement: HTMLDivElement | null | undefined;
}): number {
  const rectW = options.sidebarElement?.getBoundingClientRect().width;
  if (rectW != null && Number.isFinite(rectW) && rectW > 0) {
    return rectW;
  }
  return options.sidebarManualWidth ?? SIDEBAR_CONTENT_MIN_WIDTH_PX;
}
