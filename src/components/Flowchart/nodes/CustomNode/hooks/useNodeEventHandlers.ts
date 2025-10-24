import { CustomNodeData } from '../CustomNode';

interface NodeEventHandlersProps {
  data: CustomNodeData;
  nodeTitle: string;
  setNodeTitle: (title: string) => void;
  setIsEditingNode: (editing: boolean) => void;
  setIsHoverHeader: (hover: boolean) => void;
  hideToolbarTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setIsHoveredNode: (hovered: boolean) => void;
}

/**
 * Manages all event handlers for CustomNode
 * Extracts event handling logic to simplify the main component
 */
export function useNodeEventHandlers({
  data,
  nodeTitle,
  setNodeTitle,
  setIsEditingNode,
  setIsHoverHeader,
  hideToolbarTimeoutRef,
  setIsHoveredNode
}: NodeEventHandlersProps) {
  
  const handleEndTitleEditing = () => {
    setIsEditingNode(false);
    setIsHoverHeader(false);
    try {
      const mx = (window as any).__lastMouseX ?? 0;
      const my = (window as any).__lastMouseY ?? 0;
      const elements = document.elementsFromPoint(mx, my);
      const stillOverNode = elements.some((el: Element) => {
        return el.closest?.('[data-id]') !== null || 
               el.classList?.contains?.('react-flow__node') ||
               el.closest?.('.react-flow__node') !== null;
      });
      if (!stillOverNode) {
        setIsHoveredNode(false);
      }
    } catch (err) {
      console.error('[handleEndTitleEditing] Error checking mouse position:', err);
    }
  };

  const handleTitleUpdate = (newTitle: string) => {
    setNodeTitle(newTitle);
    if (typeof data.onUpdate === 'function') {
      data.onUpdate({ title: newTitle });
    }
  };

  const handleDeleteNode = () => {
    if (typeof data.onDelete === 'function') {
      data.onDelete();
    }
  };

  const handleNodeMouseEnter = () => {
    if (hideToolbarTimeoutRef.current) {
      clearTimeout(hideToolbarTimeoutRef.current);
      hideToolbarTimeoutRef.current = null;
    }
    setIsHoveredNode(true);
  };

  const handleNodeMouseLeave = () => {
    hideToolbarTimeoutRef.current = setTimeout(() => {
      setIsHoveredNode(false);
      hideToolbarTimeoutRef.current = null;
    }, 100);
  };

  const handleBufferMouseEnter = () => {
    if (hideToolbarTimeoutRef.current) {
      clearTimeout(hideToolbarTimeoutRef.current);
      hideToolbarTimeoutRef.current = null;
    }
    setIsHoveredNode(true);
  };

  const handleBufferMouseLeave = () => {
    if (hideToolbarTimeoutRef.current) {
      clearTimeout(hideToolbarTimeoutRef.current);
      hideToolbarTimeoutRef.current = null;
    }
    setIsHoveredNode(false);
  };

  return {
    handleEndTitleEditing,
    handleTitleUpdate,
    handleDeleteNode,
    handleNodeMouseEnter,
    handleNodeMouseLeave,
    handleBufferMouseEnter,
    handleBufferMouseLeave
  };
}

