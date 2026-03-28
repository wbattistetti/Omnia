/**
 * Subscribes to window mousemove/mouseup while `active` is true.
 * Shared by sidebar resize and right-panel splitter drag so behavior stays aligned.
 * Handlers are kept fresh via refs so listeners are not re-bound when callback deps change.
 */

import { useLayoutEffect, useRef } from 'react';

/**
 * useLayoutEffect attaches listeners before paint so the first mousemove after
 * mousedown is not missed (useEffect runs too late for drag).
 */
export function useWindowMouseDrag(
  active: boolean,
  onMove: (e: MouseEvent) => void,
  onEnd: () => void
): void {
  const moveRef = useRef(onMove);
  const endRef = useRef(onEnd);
  moveRef.current = onMove;
  endRef.current = onEnd;

  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    const handleMove = (e: MouseEvent) => moveRef.current(e);
    const handleEnd = () => endRef.current();

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [active]);
}
