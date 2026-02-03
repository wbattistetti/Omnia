// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';

export interface UseSidebarResizeParams {
  sidebarRef: React.RefObject<HTMLDivElement>;
  sidebarStartWidthRef: React.MutableRefObject<number>;
  sidebarStartXRef: React.MutableRefObject<number>;
  setIsDraggingSidebar: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Hook that provides handleSidebarResizeStart function for sidebar resize handling.
 */
export function useSidebarResize(params: UseSidebarResizeParams) {
  const {
    sidebarRef,
    sidebarStartWidthRef,
    sidebarStartXRef,
    setIsDraggingSidebar,
  } = params;

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // CRITICO: previeni che altri handler interferiscano

    const sidebarEl = sidebarRef?.current;
    if (!sidebarEl) {
      return;
    }

    const rect = sidebarEl.getBoundingClientRect();
    sidebarStartWidthRef.current = rect.width;
    sidebarStartXRef.current = e.clientX;

    setIsDraggingSidebar(true);
  }, [sidebarRef, sidebarStartWidthRef, sidebarStartXRef, setIsDraggingSidebar]);

  return handleSidebarResizeStart;
}
