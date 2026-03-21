/**
 * Observes container width to choose horizontal (side-by-side) vs stacked blocks.
 */

import { useEffect, useState, type RefObject } from 'react';

export type FlowMappingLayoutMode = 'sideBySide' | 'stacked';

/** Below this width: SEND/RECEIVE stack (typical right dock). Above: side-by-side (typical bottom dock). */
const DEFAULT_BREAKPOINT_PX = 640;

/**
 * @param breakpoint - below this width, blocks stack vertically
 */
export function useContainerWidth(
  ref: RefObject<HTMLElement | null>,
  breakpoint: number = DEFAULT_BREAKPOINT_PX
): { width: number; layout: FlowMappingLayoutMode } {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.getBoundingClientRect().width;
      setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref]);

  const layout: FlowMappingLayoutMode = width > 0 && width < breakpoint ? 'stacked' : 'sideBySide';
  return { width, layout };
}
