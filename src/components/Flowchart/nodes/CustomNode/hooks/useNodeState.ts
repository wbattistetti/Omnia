import { useState, useRef, useEffect } from 'react';
import { CustomNodeData } from '../CustomNode';
import { FlowStateBridge } from '../../../../../services/FlowStateBridge';
import { flowCanvasDiag } from '../../../utils/flowCanvasDiagnostics';

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
        FlowStateBridge.setLastMousePosition(e.clientX, e.clientY);
      } catch { }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);


  // Sync nodeTitle with data.label when data changes
  useEffect(() => {
    setNodeTitle(data.label || '');
  }, [data.label]);

  // Reset toolbar drag mode when document-level drag ends (onDraggingChange(false) in CustomNode).
  useEffect(() => {
    if (!isDragging && isToolbarDrag) {
      flowCanvasDiag('nodeState.toolbarDrag.reset', { reason: 'isDragging_false' });
      setIsToolbarDrag(false);
    }
  }, [isDragging, isToolbarDrag]);

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

