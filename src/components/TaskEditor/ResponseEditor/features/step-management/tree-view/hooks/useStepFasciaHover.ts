import { useState, useRef, useCallback, useEffect } from 'react';

export interface ToolbarPosition {
  top: number;
  left: number;
}

/**
 * Hook per gestire hover sulla fascia e calcolo posizione toolbar
 */
export function useStepFasciaHover() {
  const [hoveredStepKey, setHoveredStepKey] = useState<string | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition | null>(null);
  const fasciaRefs = useRef<Record<string, HTMLDivElement>>({});

  const registerFasciaRef = useCallback((stepKey: string, ref: HTMLDivElement | null) => {
    if (ref) {
      fasciaRefs.current[stepKey] = ref;
    } else {
      delete fasciaRefs.current[stepKey];
    }
  }, []);

  const calculateToolbarPosition = useCallback((stepKey: string): ToolbarPosition | null => {
    const fascia = fasciaRefs.current[stepKey];
    if (!fascia) return null;

    const rect = fascia.getBoundingClientRect();
    return {
      top: rect.top - 40, // 40px sopra la fascia
      left: rect.right - 60 // 60px a sinistra del bordo destro
    };
  }, []);

  const handleMouseEnter = useCallback((stepKey: string) => {
    setHoveredStepKey(stepKey);
    setTimeout(() => {
      const pos = calculateToolbarPosition(stepKey);
      setToolbarPosition(pos);
    }, 0);
  }, [calculateToolbarPosition]);

  const handleMouseLeave = useCallback(() => {
    setHoveredStepKey(null);
    setToolbarPosition(null);
  }, []);

  // Ricalcola posizione su scroll/resize
  useEffect(() => {
    if (!hoveredStepKey) return;

    const handleUpdate = () => {
      const pos = calculateToolbarPosition(hoveredStepKey);
      setToolbarPosition(pos);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [hoveredStepKey, calculateToolbarPosition]);

  return {
    hoveredStepKey,
    toolbarPosition,
    registerFasciaRef,
    handleMouseEnter,
    handleMouseLeave
  };
}
