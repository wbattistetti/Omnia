import { CustomNodeData } from '../CustomNode';
import { useFlowActionsStrict } from '../../../../../context/FlowActionsContext';
import { FlowStateBridge } from '../../../../../services/FlowStateBridge';

interface NodeEventHandlersProps {
  nodeId: string;
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
  nodeId,
  data,
  nodeTitle,
  setNodeTitle,
  setIsEditingNode,
  setIsHoverHeader,
  setIsHoveredNode,
  toolbarElementRef
}: NodeEventHandlersProps) {
  const flowActions = useFlowActionsStrict();

  const handleEndTitleEditing = () => {
    setIsEditingNode(false);
    setIsHoverHeader(false);
    try {
      const { x: mx, y: my } = FlowStateBridge.getLastMousePosition();
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
    flowActions.updateNode(nodeId, { label: newTitle });
  };

  const handleDeleteNode = () => {
    flowActions.deleteNode(nodeId);
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

