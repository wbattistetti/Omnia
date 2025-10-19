import { useCallback } from 'react';
import { Connection, Node, Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import type { NodeData, EdgeData } from '../types/flowTypes';

export function useFlowConnect(
  reactFlowInstance: any,
  connectionMenuRef: React.MutableRefObject<any>,
  setNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>,
  nodesRef: React.MutableRefObject<Node<NodeData>[]>,
  closeMenu: () => void,
  onDeleteEdge: (edgeId?: string) => void,
  deleteNodeWithLog: (nodeId: string) => void,
  updateNode: (nodeId: string, updates: Partial<NodeData>) => void,
  createAgentAct: () => void,
  createBackendCall: () => void,
  createTask: () => void,
  nodeIdCounter: React.MutableRefObject<number>
) {
  // Gestisce la connessione tra due nodi esistenti
  const onConnect = useCallback((connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    
    if (!source || !target) {
      console.warn('[FlowConnect] Invalid connection: missing source or target');
      return;
    }

    setEdges((eds) => {
      const id = uuidv4();
      return [...eds, {
        id,
        source,
        sourceHandle: sourceHandle || undefined,
        target,
        targetHandle: targetHandle || undefined,
        style: { stroke: '#8b5cf6' },
        type: 'custom',
        data: { onDeleteEdge },
        markerEnd: 'arrowhead'
      }];
    });
  }, [setEdges, onDeleteEdge]);

  // Gestisce l'inizio di una connessione
  const onConnectStart = useCallback((event: any, params: any) => {
    const { nodeId, handleId, handleType } = params;
    
    connectionMenuRef.current.sourceNodeId = nodeId;
    connectionMenuRef.current.sourceHandleId = handleId;
    connectionMenuRef.current.sourceHandleType = handleType;
    
    console.log('[FlowConnect] Connect started', {
      nodeId,
      handleId,
      handleType,
      eventType: event.type
    });
  }, [connectionMenuRef]);

  // Gestisce connessioni non condizionate (crea nuovo nodo)
  const handleSelectUnconditioned = useCallback(() => {
    const sourceNodeId = connectionMenuRef.current.sourceNodeId;
    if (!sourceNodeId) return;

    // Determina l'handle di destinazione corretto
    const getTargetHandle = (sourceHandleId: string): string => {
      switch (sourceHandleId) {
        case 'bottom': return 'top-target';
        case 'top': return 'bottom-target';
        case 'left': return 'right-target';
        case 'right': return 'left-target';
        default: return 'top-target'; // fallback
      }
    };

    const newNodeId = nodeIdCounter.toString();
    // Usa la posizione flow del rilascio se presente
    const fp = (connectionMenuRef.current as any).flowPosition;
    const position = fp ? 
      { x: fp.x - 140, y: fp.y - 20 } : 
      reactFlowInstance.screenToFlowPosition({ 
        x: connectionMenuRef.current.position.x - 140, 
        y: connectionMenuRef.current.position.y - 20 
      });

    const newNode: Node<NodeData> = {
      id: newNodeId,
      type: 'custom',
      position,
      data: {
        title: '',
        rows: [],
        onDelete: () => deleteNodeWithLog(newNodeId),
        onUpdate: (updates: any) => updateNode(newNodeId, updates),
        onCreateAgentAct: createAgentAct,
        onCreateBackendCall: createBackendCall,
        onCreateTask: createTask,
      },
    };

    const targetHandle = getTargetHandle(connectionMenuRef.current.sourceHandleId || '');

    const newEdge: Edge<EdgeData> = {
      id: `e${sourceNodeId}-${newNodeId}`,
      source: sourceNodeId || '',
      sourceHandle: connectionMenuRef.current.sourceHandleId || undefined,
      target: newNodeId,
      targetHandle: targetHandle,
      style: { stroke: '#8b5cf6' },
      type: 'custom',
      data: { onDeleteEdge },
      markerEnd: 'arrowhead'
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
    closeMenu();
  }, [
    reactFlowInstance, connectionMenuRef, setNodes, setEdges, 
    closeMenu, onDeleteEdge, deleteNodeWithLog, updateNode,
    createAgentAct, createBackendCall, createTask, nodeIdCounter
  ]);

  return {
    onConnect,
    onConnectStart,
    handleSelectUnconditioned
  };
}
