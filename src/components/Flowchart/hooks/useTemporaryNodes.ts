import { useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import type { FlowNode, EdgeData } from '../types/flowTypes';

export function useTemporaryNodes(
      setNodes: React.Dispatch<React.SetStateAction<Node<FlowNode>[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>,
  reactFlowInstance: any,
  connectionMenuRef: React.MutableRefObject<any>,
  onDeleteEdge: () => void,
  setNodesWithLog: (updater: any) => void,
  isCreatingTempNode?: React.MutableRefObject<boolean>
) {
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

    // Azzera i riferimenti temporanei
    try {
      connectionMenuRef.current.tempNodeId = null;
      connectionMenuRef.current.tempEdgeId = null;
      (window as any).__flowLastTemp = null;
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
      const tempNodeId = uuidv4();
      const tempEdgeId = uuidv4();
      const posFlow = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });

      // Calcola posizione corretta (punto mediano)
      const realNodeWidth = 140;
      const position = { x: posFlow.x - (realNodeWidth / 2), y: posFlow.y };

      // Crea nodo temporaneo HIDDEN
      const tempNode: Node<FlowNode> = {
        id: tempNodeId,
        type: 'custom',
        position,
        data: {
          label: '',
          rows: [],
          isTemporary: true,
          hidden: true, // ✅ NODO INVISIBILE
          createdAt: Date.now(),
          focusRowId: `${tempNodeId}-${uuidv4()}`,
          'data-is-temporary': 'true'
        },
      };

      // Crea collegamento temporaneo
      const tempEdge: Edge<EdgeData> = {
        id: tempEdgeId,
        source: connectionMenuRef.current.sourceNodeId || '',
        sourceHandle: connectionMenuRef.current.sourceHandleId || undefined,
        target: tempNodeId,
        style: { stroke: '#8b5cf6' },
        type: 'custom',
        data: { onDeleteEdge },
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
      } catch (error) {
        // Silent fail
      }

      return { tempNodeId, tempEdgeId, position, mouseX: event.clientX, mouseY: event.clientY };

    } catch (error) {
      throw error;
    } finally {
      // Release the lock
      if (isCreatingTempNode) {
        isCreatingTempNode.current = false;
      }
    }
  }, [reactFlowInstance, setNodesWithLog, setEdges, onDeleteEdge, connectionMenuRef, isCreatingTempNode]);

  return {
    cleanupAllTempNodesAndEdges,
    createTemporaryNode
  };
}
