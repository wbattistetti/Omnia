import { useCallback } from 'react';
import { useDynamicFontSizes } from '../../../hooks/useDynamicFontSizes';
import { Node, Edge } from 'reactflow';
import { generateSafeGuid } from '@utils/idGenerator';
import type { FlowNode, EdgeData } from '../types/flowTypes';
import { DEFAULT_LINK_STYLE } from '../types/flowTypes';
import { FlowStateBridge } from '../../../services/FlowStateBridge';
import { diagFlowLink } from '../utils/flowTempLinkDiag';
import { getSourceHandleCenterInFlow } from '../utils/sourceHandleCenterInFlow';
import type { ReactFlowStoreLike } from '../utils/waitForHandleBounds';
import { getEmptyCustomNodeMinWidthFromNodeRowCss } from '../utils/emptyCustomNodeMinWidth';
import {
  computeTempNodePaneDropPosition,
  targetHandleIdForTempEdge,
  theoreticalHandleCenterFlow,
} from '../utils/tempNodePaneDropPosition';

export function useTemporaryNodes(
      setNodes: React.Dispatch<React.SetStateAction<Node<FlowNode>[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>,
  reactFlowInstance: any,
  storeApi: ReactFlowStoreLike,
  connectionMenuRef: React.MutableRefObject<any>,
  setNodesWithLog: (updater: any) => void,
  isCreatingTempNode: React.MutableRefObject<boolean> | undefined
) {
  const fontSizes = useDynamicFontSizes();

  // Pulisce SOLO il nodo temporaneo corrente e il suo edge associato
  const cleanupAllTempNodesAndEdges = useCallback(() => {
    const tempNodeId = connectionMenuRef.current?.tempNodeId;
    const tempEdgeId = connectionMenuRef.current?.tempEdgeId;

    if (!tempNodeId && !tempEdgeId) {
      return;
    }

    // ✅ Rimuovi SOLO il nodo temporaneo corrente
    setNodes((nds) => nds.filter(n => n.id !== tempNodeId));

    // ✅ Rimuovi SOLO l'edge temporaneo corrente
    setEdges((eds) => eds.filter(e => e.id !== tempEdgeId));

    // Clear temporary references
    try {
      connectionMenuRef.current.tempNodeId = null;
      connectionMenuRef.current.tempEdgeId = null;
      FlowStateBridge.setLastTempNodeId(null);
    } catch (error) {
      // Silent fail
    }
  }, [setNodes, setEdges, connectionMenuRef]);

  // Crea un nodo temporaneo
  const createTemporaryNode = useCallback(async (event: any) => {
    // ✅ FIX: Check if we're already creating a node to prevent duplicates
    if (isCreatingTempNode && isCreatingTempNode.current) {
      return Promise.reject("Node creation already in progress");
    }

    // Set the lock flag
    if (isCreatingTempNode) {
      isCreatingTempNode.current = true;
    }

    try {
      const tempNodeId = generateSafeGuid();
      const tempEdgeId = generateSafeGuid();
      const posFlow = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });

      /** Stessa larghezza minima del CustomNode vuoto (useNodeRendering), altrimenti il centro visivo ≠ handle RF. */
      const realNodeWidth = getEmptyCustomNodeMinWidthFromNodeRowCss(fontSizes.nodeRow);
      /** Default altezza approssimata nodo vuoto per targetY prima della misura DOM. */
      const realNodeHeight = 80;

      const sourceNodeId = connectionMenuRef.current?.sourceNodeId;
      const sourceHandleIdFromRef = (connectionMenuRef.current?.sourceHandleId as string) || 'bottom';
      const sourceNode = sourceNodeId ? reactFlowInstance.getNode(sourceNodeId) : undefined;

      let position: { x: number; y: number };
      let verticalColumnDrop = false;
      let horizontalRowDrop = false;

      if (sourceNode) {
        const drop = computeTempNodePaneDropPosition({
          clientX: event.clientX,
          clientY: event.clientY,
          posFlow,
          sourceNode,
          sourceNodeId,
          sourceHandleId: sourceHandleIdFromRef,
          storeApi,
          reactFlowInstance,
          realNodeWidth,
          realNodeHeight,
        });
        position = drop.position;
        verticalColumnDrop = drop.verticalColumnDrop;
        horizontalRowDrop = drop.horizontalRowDrop;

        const measuredSourceCenter =
          sourceNodeId != null
            ? getSourceHandleCenterInFlow(storeApi, sourceNodeId, sourceHandleIdFromRef)
            : null;
        const sw = sourceNode.measured?.width ?? sourceNode.width ?? 220;
        const sh = sourceNode.measured?.height ?? sourceNode.height ?? 80;
        const toScreen = reactFlowInstance.flowToScreenPosition as
          | ((p: { x: number; y: number }) => { x: number; y: number })
          | undefined;
        const sourceCenterFlow =
          measuredSourceCenter ??
          theoreticalHandleCenterFlow(sourceNode, sw, sh, sourceHandleIdFromRef);
        let hScreen: { x: number; y: number } | null = null;
        if (typeof toScreen === 'function') {
          hScreen = toScreen.call(reactFlowInstance, sourceCenterFlow);
        }
        diagFlowLink('tempNode:position', {
          sourceNodeId,
          clientX: event.clientX,
          clientY: event.clientY,
          posFlow,
          sw,
          sh,
          measuredSourceCenter,
          sourceCenterFlow,
          usedMeasuredCenter: !!measuredSourceCenter,
          hScreen,
          deltaScreenX: hScreen !== null ? Math.abs(event.clientX - hScreen.x) : null,
          deltaScreenY: hScreen !== null ? Math.abs(event.clientY - hScreen.y) : null,
          verticalColumnDrop,
          horizontalRowDrop,
          anchorCenterX: verticalColumnDrop ? sourceCenterFlow.x : posFlow.x,
          anchorTopY: horizontalRowDrop ? sourceCenterFlow.y - realNodeHeight / 2 : posFlow.y,
          realNodeWidth,
          position,
          tempNodeId,
        });
      } else {
        position = { x: posFlow.x - realNodeWidth / 2, y: posFlow.y };
        diagFlowLink('tempNode:position(noSource)', { posFlow, position, tempNodeId });
      }

      // Crea nodo temporaneo HIDDEN
      const tempNode: Node<FlowNode> = {
        id: tempNodeId,
        type: 'custom',
        position,
        width: realNodeWidth,
        height: realNodeHeight,
        data: {
          label: '',
          rows: [],
          isTemporary: true,
          hidden: true, // ✅ NODO INVISIBILE
          createdAt: Date.now(),
          focusRowId: `${tempNodeId}-${generateSafeGuid()}`,
          'data-is-temporary': 'true'
        },
      };

      const tempEdge: Edge<EdgeData> = {
        id: tempEdgeId,
        source: connectionMenuRef.current.sourceNodeId || '',
        sourceHandle: connectionMenuRef.current.sourceHandleId || undefined,
        target: tempNodeId,
        targetHandle: targetHandleIdForTempEdge(sourceHandleIdFromRef),
        style: { stroke: '#8b5cf6' },
        type: 'custom',
        data: {
          linkStyle: DEFAULT_LINK_STYLE,
        },
        markerEnd: 'arrowhead',
      };

      // Aggiungi nodo e edge
      setNodesWithLog((nds) => [...nds, tempNode]);

      setEdges((eds) => [...eds, tempEdge]);

      // Salva riferimenti
      try {
        (connectionMenuRef.current as any).flowPosition = posFlow;
        connectionMenuRef.current.tempNodeId = tempNodeId;
        connectionMenuRef.current.tempEdgeId = tempEdgeId;
        // Expose deterministic temp node id for edge-intellisense finalization path.
        // This avoids relying on async edge-state reads when promoting temp nodes.
        FlowStateBridge.setLastTempNodeId(tempNodeId);
      } catch (error) {
        // Silent fail
      }

      return {
        tempNodeId,
        tempEdgeId,
        position,
        mouseX: event.clientX,
        mouseY: event.clientY,
        sourceNodeId: connectionMenuRef.current.sourceNodeId as string,
        sourceHandleId: (connectionMenuRef.current.sourceHandleId as string) || 'bottom',
        verticalColumnDrop,
        horizontalRowDrop,
      };

    } catch (error) {
      throw error;
    } finally {
      // Release the lock
      if (isCreatingTempNode) {
        isCreatingTempNode.current = false;
      }
    }
  }, [
    reactFlowInstance,
    storeApi,
    setNodesWithLog,
    setEdges,
    connectionMenuRef,
    isCreatingTempNode,
    fontSizes.nodeRow,
  ]);

  return {
    cleanupAllTempNodesAndEdges,
    createTemporaryNode
  };
}
