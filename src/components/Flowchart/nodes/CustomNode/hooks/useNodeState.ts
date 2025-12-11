import { useState, useRef, useEffect } from 'react';
import { CustomNodeData } from '../CustomNode';

interface UseNodeStateProps {
  data: CustomNodeData;
}

/**
 * Manages all local state for a CustomNode component
 * Extracts state management to simplify the main component
 */
export function useNodeState({ data }: UseNodeStateProps) {
  // Title editing state
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [nodeTitle, setNodeTitle] = useState(data.label || '');

  // Hover state
  const [isHoveredNode, setIsHoveredNode] = useState(false);
  const [isHoverHeader, setIsHoverHeader] = useState(false);

  // Drag state - mantiene toolbar visibile durante drag
  const [isDragging, setIsDragging] = useState(false);
  // Flag specifico: drag avviato dalla toolbar (Move/Anchor)
  const [isToolbarDrag, setIsToolbarDrag] = useState(false);

  // Visibility state for unchecked rows
  const [showUnchecked, setShowUnchecked] = useState(data.hideUncheckedRows !== true);



  // Buffer area state - removed as no longer needed

  // Computed states
  const hasTitle = (nodeTitle || '').trim().length > 0;
  const showPermanentHeader = hasTitle || isEditingNode;
  const showDragHeader = isHoveredNode && !isEditingNode && !isHoverHeader;

  // Track global mouse position for hover restoration after edit
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      try {
        (window as any).__lastMouseX = e.clientX;
        (window as any).__lastMouseY = e.clientY;
      } catch { }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);


  // Sync nodeTitle with data.label when data changes
  useEffect(() => {
    setNodeTitle(data.label || '');
  }, [data.label]);

  // Se il drag globale termina, resetta la modalità toolbar
  useEffect(() => {
    if (!isDragging && isToolbarDrag) {
      console.log('🎯 [useNodeState] Auto-resetting isToolbarDrag because isDragging became false');
      setIsToolbarDrag(false);
    }
  }, [isDragging, isToolbarDrag]);

  // Fallback: reset isToolbarDrag on any mouse/pointer up (in case onDragEnd doesn't fire)
  useEffect(() => {
    if (!isToolbarDrag) return;

    const resetToolbarDrag = () => {
      console.log('🎯 [useNodeState] Fallback reset: mouse/pointer up detected, resetting isToolbarDrag');
      setIsToolbarDrag(false);
    };

    window.addEventListener('mouseup', resetToolbarDrag, true);
    window.addEventListener('pointerup', resetToolbarDrag, true);
    window.addEventListener('mouseleave', resetToolbarDrag, true);

    return () => {
      window.removeEventListener('mouseup', resetToolbarDrag, true);
      window.removeEventListener('pointerup', resetToolbarDrag, true);
      window.removeEventListener('mouseleave', resetToolbarDrag, true);
    };
  }, [isToolbarDrag]);

  return {
    // Title editing
    isEditingNode,
    setIsEditingNode,
    nodeTitle,
    setNodeTitle,

    // Hover state
    isHoveredNode,
    setIsHoveredNode,
    isHoverHeader,
    setIsHoverHeader,

    // Drag state
    isDragging,
    setIsDragging,
    isToolbarDrag,
    setIsToolbarDrag,

    // Visibility state
    showUnchecked,
    setShowUnchecked,

    // Computed
    hasTitle,
    showPermanentHeader,
    showDragHeader
  };
}

