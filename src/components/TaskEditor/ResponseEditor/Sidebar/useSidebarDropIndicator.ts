/**
 * Drop-indicator state for HTML5 drag-reorder in the Response Editor sidebar.
 * Keeps main-row and nested-sibling indicators separate so two lists do not clash.
 */

import { useCallback, useState } from 'react';

export type DropPlacement = 'before' | 'after';

export interface MainDropIndicator {
  targetIndex: number;
  placement: DropPlacement;
}

export interface NestedDropIndicator {
  parentPath: number[];
  targetIndex: number;
  placement: DropPlacement;
}

export function useSidebarDropIndicator() {
  const [mainDrop, setMainDrop] = useState<MainDropIndicator | null>(null);
  const [nestedDrop, setNestedDrop] = useState<NestedDropIndicator | null>(null);

  const clearMain = useCallback(() => setMainDrop(null), []);
  const clearNested = useCallback(() => setNestedDrop(null), []);
  const clearAll = useCallback(() => {
    setMainDrop(null);
    setNestedDrop(null);
  }, []);

  return { mainDrop, setMainDrop, nestedDrop, setNestedDrop, clearMain, clearNested, clearAll };
}

/** Whether the pointer is in the upper or lower half of an element (for drop placement UX). */
export function dropPlacementFromEvent(e: React.DragEvent, el: HTMLElement): DropPlacement {
  const r = el.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? 'before' : 'after';
}
