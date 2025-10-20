import { useState, useRef, useCallback } from 'react';

export function useSelectionVisuals() {
  // Persisted selection rectangle (keeps the user-drawn area after mouseup)
  const [persistedSel, setPersistedSel] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const dragStartRef = useRef<null | { x: number; y: number }>(null);

  // Handler for mouse down to start selection
  const handleSelectionMouseDown = useCallback((e: React.MouseEvent, canvasRef: React.RefObject<HTMLDivElement>) => {
    const tgt = e.target as HTMLElement;
    const isPane = tgt?.classList?.contains('react-flow__pane') || !!tgt?.closest?.('.react-flow__pane');
    if (!isPane) return;
    
    // reset previous persisted rectangle and store start in canvas coords (including scroll)
    setPersistedSel(null);
    const host = canvasRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const sx = (e.clientX - rect.left) + host.scrollLeft;
    const sy = (e.clientY - rect.top) + host.scrollTop;
    dragStartRef.current = { x: sx, y: sy };
  }, []);

  // Handler for mouse up to finalize selection
  const handleSelectionMouseUp = useCallback((e: React.MouseEvent, canvasRef: React.RefObject<HTMLDivElement>) => {
    // Persist the selection rectangle exactly as drawn
    try {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      const host = canvasRef.current;
      if (start && host) {
        const rect = host.getBoundingClientRect();
        const ex = (e.clientX - rect.left) + host.scrollLeft;
        const ey = (e.clientY - rect.top) + host.scrollTop;
        const x = Math.min(start.x, ex);
        const y = Math.min(start.y, ey);
        const w = Math.abs(ex - start.x);
        const h = Math.abs(ey - start.y);
        if (w > 3 && h > 3) setPersistedSel({ x, y, w, h }); else setPersistedSel(null);
      }
    } catch {}
  }, []);

  return {
    persistedSel,
    setPersistedSel,
    dragStartRef,
    handleSelectionMouseDown,
    handleSelectionMouseUp
  };
}
