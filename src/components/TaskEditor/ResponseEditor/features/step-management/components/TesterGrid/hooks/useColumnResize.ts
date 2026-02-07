import { useState, useCallback } from 'react';

/**
 * Hook for managing column resize functionality
 */
export function useColumnResize(initialWidth: number = 280) {
  const [phraseColumnWidth, setPhraseColumnWidth] = useState<number>(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = phraseColumnWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const delta = ev.clientX - startX;
      const newWidth = Math.max(150, Math.min(600, startWidth + delta));
      setPhraseColumnWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [phraseColumnWidth]);

  return {
    phraseColumnWidth,
    isResizing,
    handleResizeStart,
  };
}
