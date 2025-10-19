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
  setNodesWithLog: (updater: any) => void
) {
  // Pulisce tutti i nodi e edge temporanei
  const cleanupAllTempNodesAndEdges = useCallback(() => {
    setNodes((nds) => nds.filter(n => !(n.data as any)?.isTemporary));
    setEdges((eds) => {
      const currentNodes = reactFlowInstance?.getNodes() || [];
      return eds.filter(e => {
        const target = currentNodes.find(n => n.id === e.target);
        return !(target && target.data && target.data.isTemporary === true);
      });
    });

    // Azzera i riferimenti temporanei
    try {
      connectionMenuRef.current.tempNodeId = null;
      connectionMenuRef.current.tempEdgeId = null;
      (window as any).__flowLastTemp = null;
    } catch {}
  }, [setNodes, setEdges, reactFlowInstance, connectionMenuRef]);

  // Crea un nodo temporaneo
  const createTemporaryNode = useCallback(async (event: any) => {
    const tempNodeId = uuidv4();
    const tempEdgeId = uuidv4();
    const posFlow = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    
    // Calcola posizione corretta (punto mediano)
    const realNodeWidth = 140;
    const position = { x: posFlow.x - (realNodeWidth / 2), y: posFlow.y };
    
    console.log("🟢 [CREATE] Creating temporary node", { 
      tempNodeId, 
      position, 
      mouseClient: { x: event.clientX, y: event.clientY },
      posFlow,
      timestamp: Date.now()
    });
    
    // Crea nodo temporaneo
    const tempNode: Node<NodeData> = {
      id: tempNodeId,
      type: 'custom',
      position,
      data: { 
        title: '', 
        rows: [],
        isTemporary: true,
        hidden: true,
        createdAt: Date.now()
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
    
    console.log("📝 [CREATE] About to add node to state", { 
      tempNodeId, 
      tempNodePosition: tempNode.position,
      timestamp: Date.now()
    });
    
    // Aggiungi nodo e edge
    setNodesWithLog((nds) => {
      const newNodes = [...nds, tempNode];
      console.log("✅ [CREATE] Node added to state", { 
        tempNodeId, 
        totalNodes: newNodes.length,
        tempNodePosition: tempNode.position,
        timestamp: Date.now()
      });
      return newNodes;
    });
    setEdges((eds) => [...eds, tempEdge]);
    
    // Salva riferimenti
    try { (connectionMenuRef.current as any).flowPosition = posFlow; } catch {}
    
    return { tempNodeId, tempEdgeId, position };
  }, [reactFlowInstance, setNodesWithLog, setEdges, onDeleteEdge, connectionMenuRef]);

  return {
    cleanupAllTempNodesAndEdges,
    createTemporaryNode
  };
}
