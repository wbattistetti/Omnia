import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (newSize: number) => void;
  min: number;
  max: number;
  initialSize: number;
  position: 'left' | 'right' | 'top' | 'bottom';
  currentSize?: number; // Per controllo esterno
  persistKey?: string; // Per persistenza localStorage
  className?: string;
  inverted?: boolean; // Per pannelli in basso che si espandono verso l'alto
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({
  direction,
  onResize,
  min,
  max,
  initialSize,
  position,
  currentSize,
  persistKey,
  className = '',
  inverted = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [internalSize, setInternalSize] = useState(initialSize);
  const dragStartRef = useRef<{ x: number; y: number; size: number } | null>(null);

  // Gestione size controllato/non controllato
  const size = currentSize ?? internalSize;

  // Persistenza opzionale
  useEffect(() => {
    if (persistKey) {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const savedSize = parseInt(saved);
        if (savedSize >= min && savedSize <= max) {
          setInternalSize(savedSize);
        }
      }
    }
  }, [persistKey, min, max]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      size: size
    };
  }, [size]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const delta = direction === 'horizontal' 
      ? e.clientX - dragStartRef.current.x
      : e.clientY - dragStartRef.current.y;

    // Per pannelli invertiti (es. ResponseEditor in basso), invertiamo il delta
    const adjustedDelta = inverted ? -delta : delta;
    
    const newSize = Math.max(min, Math.min(max, dragStartRef.current.size + adjustedDelta));
    
    if (!currentSize) {
      setInternalSize(newSize);
    }
    onResize(newSize);

    // Persistenza
    if (persistKey) {
      localStorage.setItem(persistKey, newSize.toString());
    }
  }, [isDragging, direction, min, max, onResize, currentSize, persistKey, inverted]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Gestione tastiera per accessibilità
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 10;
    let newSize = size;

    if (direction === 'horizontal') {
      if (e.key === 'ArrowLeft') newSize -= step;
      if (e.key === 'ArrowRight') newSize += step;
    } else {
      // Per pannelli invertiti, invertiamo anche i tasti freccia
      if (inverted) {
        if (e.key === 'ArrowUp') newSize += step;
        if (e.key === 'ArrowDown') newSize -= step;
      } else {
        if (e.key === 'ArrowUp') newSize -= step;
        if (e.key === 'ArrowDown') newSize += step;
      }
    }

    newSize = Math.max(min, Math.min(max, newSize));
    
    if (newSize !== size) {
      if (!currentSize) {
        setInternalSize(newSize);
      }
      onResize(newSize);
      if (persistKey) {
        localStorage.setItem(persistKey, newSize.toString());
      }
    }
  }, [size, direction, min, max, onResize, currentSize, persistKey, inverted]);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handlePointerMove, handlePointerUp, direction]);

  const isHorizontal = direction === 'horizontal';
  const ChevronIcon = isHorizontal ? ChevronRight : ChevronDown;

  // Mappatura posizioni
  const positionClass = {
    right: 'right-0 top-0',
    left: 'left-0 top-0',
    bottom: 'bottom-0 left-0',
    top: 'top-0 left-0'
  }[position];

  // Feedback visivo per limiti
  const isAtMin = size <= min;
  const isAtMax = size >= max;
  const limitColor = isAtMin || isAtMax ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div
      role="separator"
      aria-orientation={direction}
      tabIndex={0}
      className={`
        absolute ${positionClass}
        ${isHorizontal ? 'w-2 h-full' : 'h-2 w-full'}
        cursor-${isHorizontal ? 'col' : 'row'}-resize
        transition-all duration-200
        ${isHovered || isDragging ? 'bg-blue-500/20' : 'bg-transparent'}
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${className}
      `}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      style={{ zIndex: 10 }}
      title={`Trascina per ridimensionare ${direction === 'horizontal' ? 'orizzontalmente' : 'verticalmente'}`}
    >
      {/* Doppia riga + chevron quando hover */}
      {(isHovered || isDragging) && (
        <div className={`
          absolute inset-0 flex items-center justify-center
          ${isHorizontal ? 'flex-col' : 'flex-row'}
        `}>
          <div className={`
            ${isHorizontal ? 'w-0.5 h-8' : 'h-0.5 w-8'}
            ${limitColor} rounded-full
          `} />
          <ChevronIcon 
            size={12} 
            className={`${limitColor.replace('bg-', 'text-')} mx-1`}
          />
          <div className={`
            ${isHorizontal ? 'w-0.5 h-8' : 'h-0.5 w-8'}
            ${limitColor} rounded-full
          `} />
        </div>
      )}
    </div>
  );
};

export default ResizeHandle; 