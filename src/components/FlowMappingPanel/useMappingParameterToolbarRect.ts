/**
 * Tracks anchor getBoundingClientRect while toolbar is shown (scroll/resize safe).
 */

import { useLayoutEffect, useState, type RefObject } from 'react';

export function useMappingParameterToolbarRect(
  anchorRef: RefObject<HTMLElement | null>,
  active: boolean
): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) {
      setRect(null);
      return;
    }
    const update = () => {
      const node = anchorRef.current;
      setRect(node ? node.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active, anchorRef]);

  return rect;
}
