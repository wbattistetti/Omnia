import { useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import type { NodeData, EdgeData } from '../types/flowTypes';

export function useTemporaryNodes(
  setNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>,
  reactFlowInstance: any,
  connectionMenuRef: React.MutableRefObject<any>,
  onDeleteEdge: () => void,
  setNodesWithLog: (updater: any) => void,
  isCreatingTempNode?: React.MutableRefObject<boolean>
) {
  // Pulisce tutti i nodi e edge temporanei
  const cleanupAllTempNodesAndEdges = useCallback(() => {
    console.log("🧹 [CLEANUP] Starting cleanup of all temporary nodes and edges");
    setNodes((nds) => {
      const filtered = nds.filter(n => !(n.data as any)?.isTemporary);
      console.log("🧹 [CLEANUP] Filtered nodes", {
        before: nds.length,
        after: filtered.length,
        tempNodesRemoved: nds.length - filtered.length
      });
      return filtered;
    });
    setEdges((eds) => {
      const currentNodes = reactFlowInstance?.getNodes() || [];
      const filtered = eds.filter(e => {
        const target = currentNodes.find(n => n.id === e.target);
        return !(target && target.data && target.data.isTemporary === true);
      });
      console.log("🧹 [CLEANUP] Filtered edges", {
        before: eds.length,
        after: filtered.length,
        tempEdgesRemoved: eds.length - filtered.length
      });
      return filtered;
    });

    // Azzera i riferimenti temporanei
    try {
      connectionMenuRef.current.tempNodeId = null;
      connectionMenuRef.current.tempEdgeId = null;
      (window as any).__flowLastTemp = null;
      console.log("🧹 [CLEANUP] Reset temporary references");
    } catch (error) {
      console.error("❌ [CLEANUP] Error resetting temporary references:", error);
    }
  }, [setNodes, setEdges, reactFlowInstance, connectionMenuRef]);

  // Crea un nodo temporaneo
  const createTemporaryNode = useCallback(async (event: any) => {
    console.log("🎯 [CREATE_TEMP] Starting temporary node creation");

    // ✅ FIX: Check if we're already creating a node to prevent duplicates
    if (isCreatingTempNode && isCreatingTempNode.current) {
      console.log("🚫 [CREATE_TEMP] BLOCKED - Node creation already in progress");
      return Promise.reject("Node creation already in progress");
    }

    // Set the lock flag
    if (isCreatingTempNode) {
      isCreatingTempNode.current = true;
      console.log("🔒 [CREATE_TEMP] Lock acquired");
    }

    try {
      const tempNodeId = uuidv4();
      const tempEdgeId = uuidv4();
      const posFlow = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });

      // Calcola posizione corretta (punto mediano)
      const realNodeWidth = 140;
      const position = { x: posFlow.x - (realNodeWidth / 2), y: posFlow.y };

      console.log("🟢 [CREATE_TEMP] Creating temporary node", {
        tempNodeId,
        position,
        mouseClient: { x: event.clientX, y: event.clientY },
        posFlow,
        timestamp: Date.now()
      });

      // Crea nodo temporaneo HIDDEN
      const tempNode: Node<NodeData> = {
        id: tempNodeId,
        type: 'custom',
        position,
        data: {
          title: '',
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

      console.log("📝 [CREATE_TEMP] About to add node to state", {
        tempNodeId,
        tempNodePosition: tempNode.position,
        timestamp: Date.now()
      });

      // Aggiungi nodo e edge
      setNodesWithLog((nds) => {
        const newNodes = [...nds, tempNode];
        console.log("✅ [CREATE_TEMP] Node added to state", {
          tempNodeId,
          totalNodes: newNodes.length,
          tempNodePosition: tempNode.position,
          tempNodeData: tempNode.data,
          isTemporary: (tempNode.data as any)?.isTemporary,
          hidden: (tempNode.data as any)?.hidden,
          timestamp: Date.now()
        });
        return newNodes;
      });

      setEdges((eds) => {
        const newEdges = [...eds, tempEdge];
        console.log("✅ [CREATE_TEMP] Edge added to state", {
          tempEdgeId,
          totalEdges: newEdges.length,
          timestamp: Date.now()
        });
        return newEdges;
      });

      // Salva riferimenti
      try {
        (connectionMenuRef.current as any).flowPosition = posFlow;
        connectionMenuRef.current.tempNodeId = tempNodeId;
        connectionMenuRef.current.tempEdgeId = tempEdgeId;
        console.log("💾 [CREATE_TEMP] Saved references", {
          tempNodeId,
          tempEdgeId,
          flowPosition: posFlow
        });
      } catch (error) {
        console.error("❌ [CREATE_TEMP] Error saving references:", error);
      }

      return { tempNodeId, tempEdgeId, position, mouseX: event.clientX, mouseY: event.clientY };

    } catch (error) {
      console.error("❌ [CREATE_TEMP] Error creating temporary node:", error);
      throw error;
    } finally {
      // Release the lock
      if (isCreatingTempNode) {
        isCreatingTempNode.current = false;
        console.log("🔓 [CREATE_TEMP] Lock released");
      }
    }
  }, [reactFlowInstance, setNodesWithLog, setEdges, onDeleteEdge, connectionMenuRef, isCreatingTempNode]);

  return {
    cleanupAllTempNodesAndEdges,
    createTemporaryNode
  };
}
