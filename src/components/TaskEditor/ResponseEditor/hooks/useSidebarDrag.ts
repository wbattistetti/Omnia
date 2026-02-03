// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';

export interface UseSidebarDragParams {
  isDraggingSidebar: boolean;
  sidebarStartWidthRef: React.MutableRefObject<number>;
  sidebarStartXRef: React.MutableRefObject<number>;
  setSidebarManualWidth: React.Dispatch<React.SetStateAction<number | null>>;
  setIsDraggingSidebar: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Hook that handles sidebar drag interactions.
 */
export function useSidebarDrag(params: UseSidebarDragParams) {
  const {
    isDraggingSidebar,
    sidebarStartWidthRef,
    sidebarStartXRef,
    setSidebarManualWidth,
    setIsDraggingSidebar,
  } = params;

  useEffect(() => {
    if (!isDraggingSidebar) {
      return;
    }

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - sidebarStartXRef.current;
      const MIN_WIDTH = 160;
      const MAX_WIDTH = 1000;
      const calculatedWidth = sidebarStartWidthRef.current + deltaX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, calculatedWidth));

      setSidebarManualWidth(newWidth);
    };

    const handleUp = () => {
      setIsDraggingSidebar(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingSidebar, sidebarStartWidthRef, sidebarStartXRef, setSidebarManualWidth, setIsDraggingSidebar]);
}
