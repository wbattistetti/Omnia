import { CustomNodeData } from '../CustomNode';

interface NodeEventHandlersProps {
  data: CustomNodeData;
  nodeTitle: string;
  setNodeTitle: (title: string) => void;
  setIsEditingNode: (editing: boolean) => void;
  setIsHoverHeader: (hover: boolean) => void;
  setIsHoveredNode: (hovered: boolean) => void;
  toolbarElementRef?: React.RefObject<HTMLDivElement>; // Ref della toolbar per verificare hover
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
  setIsHoveredNode,
  toolbarElementRef
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
      data.onUpdate({ label: newTitle });
    }
  };

  const handleDeleteNode = () => {
    if (typeof data.onDelete === 'function') {
      data.onDelete();
    }
  };

  const handleNodeMouseEnter = () => {
    setIsHoveredNode(true);
  };

  const handleNodeMouseLeave = (e?: React.MouseEvent) => {
    // Verifica se il mouse sta andando verso la toolbar
    const relatedTarget = e?.relatedTarget as HTMLElement;
    if (relatedTarget && toolbarElementRef?.current?.contains(relatedTarget)) {
      console.log('[handleNodeMouseLeave] Mouse va verso toolbar - MANTIENI visibile');
      return;
    }
    // Non nascondiamo qui - lasciamo che sia la toolbar o il wrapper a gestire
    // perché il mouse potrebbe ancora transitare
  };

  const handleBufferMouseEnter = () => {
    setIsHoveredNode(true);
  };

  const handleBufferMouseLeave = () => {
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

