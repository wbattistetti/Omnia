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
  const [nodeTitle, setNodeTitle] = useState(data.title || '');
  
  // Hover state
  const [isHoveredNode, setIsHoveredNode] = useState(false);
  const [isHoverHeader, setIsHoverHeader] = useState(false);
  
  // Buffer area state
  const [nodeBufferRect, setNodeBufferRect] = useState<{ 
    top: number; 
    left: number; 
    width: number; 
    height: number 
  } | null>(null);
  
  // Refs
  const hideToolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideToolbarTimeoutRef.current) {
        clearTimeout(hideToolbarTimeoutRef.current);
      }
    };
  }, []);

  // Sync nodeTitle with data.title when data changes
  useEffect(() => {
    setNodeTitle(data.title || '');
  }, [data.title]);

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
    
    // Buffer area
    nodeBufferRect,
    setNodeBufferRect,
    
    // Refs
    hideToolbarTimeoutRef,
    
    // Computed
    hasTitle,
    showPermanentHeader,
    showDragHeader
  };
}

