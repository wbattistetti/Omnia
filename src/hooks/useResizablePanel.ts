import { useState, useCallback, useEffect } from 'react';

interface UseResizablePanelOptions {
  initialSize: number;
  min: number;
  max: number;
  direction: 'horizontal' | 'vertical';
  persistKey?: string;
}

export const useResizablePanel = ({
  initialSize,
  min,
  max,
  direction,
  persistKey
}: UseResizablePanelOptions) => {
  const [size, setSize] = useState(initialSize);

  // Carica dimensione salvata
  useEffect(() => {
    if (persistKey) {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const savedSize = parseInt(saved);
        if (savedSize >= min && savedSize <= max) {
          setSize(savedSize);
        }
      }
    }
  }, [persistKey, min, max]);

  const handleResize = useCallback((newSize: number) => {
    setSize(newSize);
    if (persistKey) {
      localStorage.setItem(persistKey, newSize.toString());
    }
  }, [persistKey]);

  const style = direction === 'horizontal' 
    ? { width: size }
    : { height: size };

  return {
    size,
    handleResize,
    style
  };
}; 