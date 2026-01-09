import { useState, useRef, useEffect, useCallback } from 'react';

export interface UsePanelResizeOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey: string;
}

export interface UsePanelResizeReturn {
  width: number;
  isDragging: boolean;
  handleStart: (e: React.MouseEvent) => void;
}

/**
 * Centralized hook for panel resize logic.
 * Handles mouse drag, localStorage persistence, and width constraints.
 */
export function usePanelResize({
  initialWidth,
  minWidth,
  maxWidth,
  storageKey,
}: UsePanelResizeOptions): UsePanelResizeReturn {
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return initialWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const startWidthRef = useRef(0);
  const startXRef = useRef(0);

  const handleStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startWidthRef.current = width;
    startXRef.current = e.clientX;
    setIsDragging(true);
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startWidthRef.current + deltaX)
      );
      setWidth(newWidth);
      try {
        localStorage.setItem(storageKey, String(newWidth));
      } catch {
        // Ignore localStorage errors
      }
    };

    const handleUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, minWidth, maxWidth, storageKey]);

  return { width, isDragging, handleStart };
}

