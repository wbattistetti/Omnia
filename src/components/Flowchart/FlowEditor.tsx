import React, { useCallback, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
  useReactFlow,
  ReactFlowInstance,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CustomNode } from './CustomNode';
import { EdgeConditionSelector } from './EdgeConditionSelector';
import { Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CustomEdge } from './CustomEdge';
import { useEdgeManager, EdgeData } from '../../hooks/useEdgeManager';
import { useConnectionMenu } from '../../hooks/useConnectionMenu';
import { useNodeManager, NodeData } from '../../hooks/useNodeManager';

export type { NodeData } from '../../hooks/useNodeManager';
export type { EdgeData } from '../../hooks/useEdgeManager';

const nodeTypes = {
  custom: CustomNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const initialNodes: Node<NodeData>[] = [];
const initialEdges: Edge<EdgeData>[] = [];

interface FlowEditorProps {
  testPanelOpen: boolean;
  setTestPanelOpen: (open: boolean) => void;
  testNodeId: string | null;
  setTestNodeId: (id: string | null) => void;
  onPlayNode: (nodeId: string, nodeRows: any[]) => void;
  nodes: Node<NodeData>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>;
  edges: Edge<EdgeData>[];
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>;
}

const FlowEditorContent: React.FC<FlowEditorProps> = ({
  testPanelOpen,
  setTestPanelOpen,
  testNodeId,
  setTestNodeId,
  onPlayNode,
  nodes,
  setNodes,
  edges,
  setEdges
}) => {
  // Ref sempre aggiornata con lo stato dei nodi
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const [nodeIdCounter, setNodeIdCounter] = useState(3);
  // Sostituisco la gestione connectionMenu con l'hook
  const {
    connectionMenu,
    openMenu,
    closeMenu,
    setSource,
    setTarget,
    setTemp,
    setPosition,
    connectionMenuRef
  } = useConnectionMenu();
  const reactFlowInstance = useReactFlow();
  const lastClickTime = useRef(0);
  // Rimuovo tempEdgeIdState
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Usa l'hook edge manager
  const { addEdge: addEdgeManaged, patchEdges, deleteEdge: deleteEdgeManaged } = useEdgeManager(setEdges);

  // Sostituisco onDeleteEdge
  const onDeleteEdge = useCallback((edgeId: string) => {
    deleteEdgeManaged(edgeId);
  }, [deleteEdgeManaged]);

  // Keep ref updated with latest connectionMenu state
  React.useEffect(() => {
    // connectionMenuRef.current = connectionMenu; // This is now handled by the hook
  }, [connectionMenu]);

  // Ref per memorizzare l'ID dell'ultima edge creata (sia tra nodi esistenti che con nodo temporaneo)
  const pendingEdgeIdRef = useRef<string | null>(null);

  // Sostituisco onConnect
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdgeId = uuidv4();
      addEdgeManaged({
        ...params,
        id: newEdgeId,
        source: params.source || '',
        target: params.target || '',
        sourceHandle: params.sourceHandle || undefined,
        targetHandle: params.targetHandle || undefined,
        style: { stroke: '#8b5cf6' },
        data: { onDeleteEdge }
      });
      // Salva l'ID dell'edge appena creata
      pendingEdgeIdRef.current = newEdgeId;
      // Se source e target sono entrambi nodi esistenti, apri subito intellisense
      if (params.source && params.target) {
        // Trova posizione del target node per posizionare il menu
        const targetNodeEl = document.querySelector(`.react-flow__node[data-id='${params.target}']`);
        let menuPos = { x: 0, y: 0 };
        if (targetNodeEl) {
          const rect = targetNodeEl.getBoundingClientRect();
          menuPos = { x: rect.left + rect.width / 2, y: rect.top };
        }
        openMenu(menuPos, params.source, params.sourceHandle);
      }
    },
    [addEdgeManaged, onDeleteEdge, openMenu],
  );

  const { addNode, deleteNode, updateNode, addNodeAtPosition } = useNodeManager(setNodes, setNodeIdCounter);

  // Patch all edges after mount
  React.useEffect(() => {
    patchEdges();
  }, [patchEdges]);

  // Update existing nodes with callbacks and onPlayNode
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onDelete: () => deleteNode(node.id),
          onUpdate: (updates: any) => updateNode(node.id, updates),
          onPlayNode: onPlayNode ? () => onPlayNode(node.id, node.data.rows) : undefined,
        },
      }))
    );
  }, [deleteNode, updateNode, setNodes, onPlayNode]);

  // Aggiorna edges con onUpdate per ogni edge custom
  useEffect(() => {
    setEdges(eds => eds.map(e =>
      e.type === 'custom'
        ? {
            ...e,
            data: {
              ...e.data,
              onDeleteEdge,
              onUpdate: (updates: any) => {
                let safeUpdates = { ...updates };
                if (typeof updates.label === 'object' && updates.label !== null) {
                  safeUpdates.label = updates.label.description || updates.label.name || '';
                }
                setEdges(prevEdges => {
                  const updated = prevEdges.map(edge =>
                    edge.id === e.id ? { ...edge, ...safeUpdates } : edge
                  );
                  return updated;
                });
              }
            }
          }
        : e
    ));
  }, [onDeleteEdge, setEdges]);

  // Forza tutti gli edge a solidi dopo il mount o ogni volta che edges cambiano
  React.useEffect(() => {
    setEdges((eds) =>
      eds.map(e =>
        e.style && e.style.strokeDasharray
          ? { ...e, style: { ...e.style, strokeDasharray: undefined } }
          : e
      )
    );
  }, [setEdges]);

  const NODE_WIDTH = 280; // px (tailwind w-70)
  const NODE_HEIGHT = 40; // px (min-h-[40px])

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setSelectedEdgeId(null); // Reset edge selezionata quando si clicca sul canvas
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime.current;
    
    // Double click detection (within 300ms)
    if (timeDiff < 300) {
      event.preventDefault();
      const newNodeId = nodeIdCounter.toString();
      const node: Node<NodeData> = {
        id: newNodeId,
        type: 'custom',
        position: { x: 0, y: 0 }, // verrà sovrascritto
        data: {
          title: 'Title missing...',
          rows: [{ id: '1', text: 'New action' }],
          onDelete: () => deleteNode(newNodeId),
          onUpdate: (updates: any) => updateNode(newNodeId, updates),
        },
      };
      // Centra il nodo rispetto al click
      const { x, y } = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - NODE_WIDTH / 2,
        y: event.clientY - NODE_HEIGHT / 2,
      });
      addNodeAtPosition(node, x, y);
    }
    
    lastClickTime.current = currentTime;
  }, [addNodeAtPosition, nodeIdCounter, deleteNode, updateNode, reactFlowInstance]);

  const onConnectStart = useCallback((event: any, { nodeId, handleId }: any) => {
    setSource(nodeId || '', handleId || undefined);
  }, []);

  // Rimuove TUTTI i nodi e edge temporanei
  function cleanupAllTempNodesAndEdges() {
    // setNodes((nds) => nds.filter(n => !n.data?.isTemporary));
    setEdges((eds) => removeAllTempEdges(eds, nodesRef.current));
  }

  const onConnectEnd = useCallback((event: any) => {
    // Prima di tutto, pulisci eventuali edge/nodi temporanei rimasti
    cleanupAllTempNodesAndEdges();
    const targetIsPane = event.target.classList.contains('react-flow__pane');
    if (targetIsPane && connectionMenuRef.current.sourceNodeId) {
      // ... (logica nodo temporaneo come ora)
      const tempNodeId = uuidv4();
      const tempEdgeId = uuidv4();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - 1,
        y: event.clientY - 1
      });
      // Crea nodo temporaneo invisibile
      const tempNode: Node<NodeData> = {
        id: tempNodeId,
        type: 'custom',
        position,
        data: { 
          title: '', 
          rows: [],
          isTemporary: true
        },
      };
      // Crea collegamento temporaneo tratteggiato
      const tempEdge: Edge<EdgeData> = {
        id: tempEdgeId,
        source: connectionMenuRef.current.sourceNodeId || '',
        sourceHandle: connectionMenuRef.current.sourceHandleId || undefined,
        target: tempNodeId,
        style: { stroke: '#8b5cf6' }, // tratteggiato
        type: 'custom',
        data: { onDeleteEdge },
        markerEnd: 'arrowhead',
      };
      setNodes((nds) => [...nds, tempNode]);
      setEdges((eds) => [...eds, tempEdge]);
      tempEdgeIdGlobal.current = tempEdgeId;
      setTemp(tempNodeId, tempEdgeId);
      openMenu({ x: event.clientX, y: event.clientY }, connectionMenuRef.current.sourceNodeId, connectionMenuRef.current.sourceHandleId);
    }
  }, [reactFlowInstance, setNodes, setEdges, onDeleteEdge, openMenu, setSource, setTarget, connectionMenuRef, setTemp, edges]);

  // Utility per rimuovere edge temporaneo
  function removeTempEdge(eds: Edge[], tempEdgeId: string | undefined) {
    if (tempEdgeId) {
      return eds.filter(e => e.id !== tempEdgeId);
    }
    return eds;
  }

  // Una edge è temporanea se il suo target è un nodo temporaneo (usando lo stato più recente dei nodi)
  const removeAllTempEdges = (eds: Edge[], currentNodes: Node[]) => {
    const filtered = eds.filter(e => {
      const targetNode = currentNodes.find(n => n.id === e.target);
      const isTemp = !!(targetNode && targetNode.data && targetNode.data.isTemporary);
      return !isTemp;
    });
    return filtered;
  };

  const handleSelectCondition = useCallback((item: any) => {
    // Se c'è un edge ID pending, aggiorna solo quell'edge
    if (pendingEdgeIdRef.current) {
      setEdges((eds) =>
        eds.map(e =>
          e.id === pendingEdgeIdRef.current
            ? { ...e, label: item.description || item.name || '' }
            : e
        )
      );
      setSelectedEdgeId(pendingEdgeIdRef.current);
      pendingEdgeIdRef.current = null;
      closeMenu();
      return;
    }
    if (connectionMenuRef.current.sourceNodeId && connectionMenuRef.current.targetNodeId) {
      const newEdgeId = uuidv4();
      setEdges((eds) => {
        const filtered = removeAllTempEdges(eds, nodes);
        const newEdge = {
          id: newEdgeId,
          source: connectionMenuRef.current.sourceNodeId || '',
          sourceHandle: connectionMenuRef.current.sourceHandleId || undefined,
          target: connectionMenuRef.current.targetNodeId || '',
          targetHandle: connectionMenuRef.current.targetHandleId || undefined,
          style: { stroke: '#8b5cf6' },
          label: item.description || item.name || '',
          type: 'custom',
          data: { onDeleteEdge },
          markerEnd: 'arrowhead',
        } as Edge;
        return [...filtered, newEdge];
      });
      setSelectedEdgeId(newEdgeId);
      closeMenu();
      return;
    }
    // Determina l'handle di destinazione corretto basato sull'handle sorgente
    const getTargetHandle = (sourceHandleId: string): string => {
      switch (sourceHandleId) {
        case 'bottom':
          return 'top-target';
        case 'top':
          return 'bottom-target';
        case 'left':
          return 'right-target';
        case 'right':
          return 'left-target';
        default:
          return 'top-target'; // fallback
      }
    };
    const newNodeId = nodeIdCounter.toString();
    const position = reactFlowInstance.screenToFlowPosition({
      x: connectionMenuRef.current.position.x - 140,
      y: connectionMenuRef.current.position.y - 20
    });
    const newEdgeId = uuidv4();
    const newNode: Node<NodeData> = {
      id: newNodeId,
      type: 'custom',
      position,
      data: {
        title: 'Title missing...', // <-- sempre questo!
        rows: [{ id: '1', text: 'New action' }],
        onDelete: () => deleteNode(newNodeId),
        onUpdate: (updates: any) => updateNode(newNodeId, updates),
      },
    };
    const targetHandle = getTargetHandle(connectionMenuRef.current.sourceHandleId || '');
    const newEdge: Edge<EdgeData> = {
      id: newEdgeId,
      source: connectionMenuRef.current.sourceNodeId || '',
      sourceHandle: connectionMenuRef.current.sourceHandleId || undefined,
      target: newNodeId,
      targetHandle: targetHandle,
      style: { stroke: '#8b5cf6' }, // solido
      label: item.description || item.name || '', // <-- label/caption
      type: 'custom',
      data: { onDeleteEdge },
      markerEnd: 'arrowhead',
    };
    // Operazione atomica: rimuovi temporanei e aggiungi definitivi
    setNodes((nds) => {
      const filtered = connectionMenuRef.current.tempNodeId ? 
        nds.filter(n => n.id !== connectionMenuRef.current.tempNodeId) : nds;
      return [...filtered, newNode];
    });
    setEdges((eds) => {
      const filtered = removeAllTempEdges(eds, nodesRef.current);
      return [...filtered, newEdge];
    });
    setNodeIdCounter(prev => prev + 1);
    setSelectedEdgeId(newEdgeId);
    closeMenu();
  }, [setEdges, nodeIdCounter, onDeleteEdge, updateNode, deleteNode, setNodes, reactFlowInstance, connectionMenuRef, nodes]);

  const handleSelectUnconditioned = useCallback(() => {
    const sourceNodeId = connectionMenuRef.current.sourceNodeId;
    if (!sourceNodeId) return;

    // Determina l'handle di destinazione corretto basato sull'handle sorgente
    const getTargetHandle = (sourceHandleId: string): string => {
      switch (sourceHandleId) {
        case 'bottom':
          return 'top-target';
        case 'top':
          return 'bottom-target';
        case 'left':
          return 'right-target';
        case 'right':
          return 'left-target';
        default:
          return 'top-target'; // fallback
      }
    };

    const newNodeId = nodeIdCounter.toString();
    const position = reactFlowInstance.screenToFlowPosition({
      x: connectionMenuRef.current.position.x - 140,
      y: connectionMenuRef.current.position.y - 20
    });

    const newNode: Node<NodeData> = {
      id: newNodeId,
      type: 'custom',
      position,
      data: {
        title: 'New Node',
        rows: [{ id: '1', text: 'New action' }],
        onDelete: () => deleteNode(newNodeId),
        onUpdate: (updates: any) => updateNode(newNodeId, updates),
      },
    };

    const targetHandle = getTargetHandle(connectionMenuRef.current.sourceHandleId || '');

    const newEdge: Edge<EdgeData> = {
      id: `e${sourceNodeId}-${newNodeId}`,
      source: sourceNodeId || '',
      sourceHandle: connectionMenuRef.current.sourceHandleId || undefined,
      target: newNodeId,
      targetHandle: targetHandle,
      style: { stroke: '#8b5cf6' }, // solido
      type: 'custom',
      data: { onDeleteEdge },
      markerEnd: 'arrowhead',
      // No label for unconditioned link
    };

    // Operazione atomica: rimuovi temporanei e aggiungi definitivi
    setNodes((nds) => {
      const filtered = connectionMenuRef.current.tempNodeId ? 
        nds.filter(n => n.id !== connectionMenuRef.current.tempNodeId) : nds;
      return [...filtered, newNode];
    });
    setEdges((eds) => {
      const filtered = removeAllTempEdges(eds, nodesRef.current);
      return [...filtered, newEdge];
    });
    setNodeIdCounter(prev => prev + 1);
    closeMenu();
  }, [nodeIdCounter, onDeleteEdge, updateNode, deleteNode, setNodes, setEdges, reactFlowInstance, connectionMenuRef, nodes]);

  // Handler robusto per chiusura intellisense/condition menu
  const handleConnectionMenuClose = useCallback(() => {
    // Rimuovi nodo e collegamento temporanei se esistono
    cleanupAllTempNodesAndEdges();
    closeMenu();
  }, [closeMenu]);

  const onNodeDragStart = useCallback((event: any, node: Node) => {
    // Controlla se l'evento è iniziato da un elemento con classe 'nodrag'
    const target = event.target as Element;
    if (target && (target.classList.contains('nodrag') || target.closest('.nodrag'))) {
      event.preventDefault();
      return false;
    }
  }, []);

  // Handler per selezione edge
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
  }, []);

  return (
    <div className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges.map(e => ({ ...e, selected: e.id === selectedEdgeId }))}
        onNodesChange={changes => setNodes(nds => applyNodeChanges(changes, nds))}
        onEdgesChange={changes => setEdges(eds => applyEdgeChanges(changes, eds))}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={onPaneClick}
        onEdgeClick={handleEdgeClick}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={onNodeDragStart}
        fitView
        className="bg-white"
        style={{ backgroundColor: '#ffffff' }}
      >
        <Controls className="bg-white shadow-lg border border-slate-200" />
        <Background 
          variant={BackgroundVariant.Dots}
          gap={20}
          size={2}
          color="#e2e8f0"
          style={{ backgroundColor: '#ffffff' }}
        />
        <svg style={{ height: 0 }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,5 L0,10 Z" fill="#8b5cf6" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
      
      {/* Floating Add Button */}
      <button
        onClick={() => {
          const newNodeId = nodeIdCounter.toString();
          const node: Node<NodeData> = {
            id: newNodeId,
            type: 'custom',
            position: { x: 0, y: 0 },
            data: {
              title: 'Title missing...',
              rows: [{ id: '1', text: 'New action' }],
              onDelete: () => deleteNode(newNodeId),
              onUpdate: (updates: any) => updateNode(newNodeId, updates),
            },
          };
          // Centra il nodo rispetto alla posizione random
          const randomX = Math.random() * 400 + 100;
          const randomY = Math.random() * 400 + 100;
          const { x, y } = reactFlowInstance.screenToFlowPosition({
            x: randomX - NODE_WIDTH / 2,
            y: randomY - NODE_HEIGHT / 2,
          });
          addNodeAtPosition(node, x, y);
        }}
        className="absolute top-4 right-4 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-colors z-10"
        title="Add new node (or double-click on canvas)"
      >
        <Plus className="w-5 h-5" />
      </button>
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-slate-800 text-white px-3 py-2 rounded-lg text-sm shadow-lg z-10">
        💡 Double-click sul canvas per creare un nodo centrato
      </div>
      
      {connectionMenu.show && (
        <EdgeConditionSelector
          position={connectionMenu.position}
          onSelectCondition={handleSelectCondition}
          onSelectUnconditioned={handleSelectUnconditioned}
          onClose={handleConnectionMenuClose}
        />
      )}
    </div>
  );
};

// Ref globale per edge temporaneo
const tempEdgeIdGlobal = { current: null as string | null };

export const FlowEditor: React.FC<FlowEditorProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowEditorContent {...props} />
    </ReactFlowProvider>
  );
};