import React, { useCallback, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CheckSquare } from 'lucide-react';
import { CustomNode } from './CustomNode';
import { TaskNode } from './TaskNode';
import { EdgeConditionSelector } from './EdgeConditionSelector';
import { v4 as uuidv4 } from 'uuid';
import { CustomEdge } from './CustomEdge';
import { useEdgeManager, EdgeData } from '../../hooks/useEdgeManager';
import { useConnectionMenu } from '../../hooks/useConnectionMenu';
import { useNodeManager, NodeData } from '../../hooks/useNodeManager';

export type { NodeData } from '../../hooks/useNodeManager';
export type { EdgeData } from '../../hooks/useEdgeManager';

// nodeTypes/edgeTypes memoized below

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
  currentProject: any;
  setCurrentProject: (project: any) => void;
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
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectionMenu, setSelectionMenu] = useState<{ show: boolean; x: number; y: number }>(() => ({ show: false, x: 0, y: 0 }));

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
      // Resetta subito dopo il tick per consentire onConnectEnd di capire se la connessione ha davvero aggiunto l'edge
      setTimeout(() => { pendingEdgeIdRef.current = null; }, 0);
    },
    [addEdgeManaged, onDeleteEdge, openMenu],
  );

  // Log dettagliato su ogni cambiamento di nodes.length
  useEffect(() => {
    if (reactFlowInstance) {
      const viewport = reactFlowInstance.getViewport ? reactFlowInstance.getViewport() : { x: 0, y: 0, zoom: 1 };
      const viewportEl = document.querySelector('.react-flow') as HTMLElement;
      const rect = viewportEl ? viewportEl.getBoundingClientRect() : null;
    }
  }, [nodes.length, reactFlowInstance]);

  // Log su addNodeAtPosition e deleteNode
  const { addNode, deleteNode, updateNode, addNodeAtPosition: originalAddNodeAtPosition } = useNodeManager(setNodes, setNodeIdCounter);
  const addNodeAtPosition = useCallback((node: Node<NodeData>, x: number, y: number) => {
    originalAddNodeAtPosition(node, x, y);
  }, [originalAddNodeAtPosition]);
  const deleteNodeWithLog = useCallback((id: string) => {
    deleteNode(id);
  }, [deleteNode]);

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
          onDelete: () => deleteNodeWithLog(node.id),
          onUpdate: (updates: any) => updateNode(node.id, updates),
          onPlayNode: onPlayNode ? () => onPlayNode(node.id, node.data.rows) : undefined,
        },
      }))
    );
  }, [deleteNodeWithLog, updateNode, setNodes, onPlayNode]);

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
  const canvasRef = useRef<HTMLDivElement>(null);
  const [contentSize, setContentSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Calcola estensione contenuto per eventuali scrollbar
  useEffect(() => {
    const pad = 200; // padding intorno al contenuto
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    if (nodes.length > 0) {
      minX = Math.min(...nodes.map(n => (n.position as any).x));
      minY = Math.min(...nodes.map(n => (n.position as any).y));
      maxX = Math.max(...nodes.map(n => (n.position as any).x + NODE_WIDTH));
      const approxHeights = nodes.map(n => {
        const rows = (n.data as any)?.rows;
        const count = Array.isArray(rows) ? rows.length : 0;
        return NODE_HEIGHT + (count * 24) + 40;
      });
      maxY = Math.max(...nodes.map((n, i) => (n.position as any).y + approxHeights[i]));
    }
    const w = Math.max(0, maxX - minX) + pad * 2;
    const h = Math.max(0, maxY - minY) + pad * 2;
    setContentSize({ w, h });
  }, [nodes]);

  const createNodeAt = useCallback((clientX: number, clientY: number) => {
    // debug logs removed
    const newNodeId = nodeIdCounter.toString();
    let x = 0, y = 0;
    if (reactFlowInstance) {
      const pos = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
      // debug logs removed
      x = pos.x - NODE_WIDTH / 2;
      y = pos.y - NODE_HEIGHT / 2;
    }
    const node: Node<NodeData> = {
      id: newNodeId,
      type: 'custom',
      position: { x, y },
      data: {
        title: 'Title missing...',
        rows: [],
        onDelete: () => deleteNodeWithLog(newNodeId),
        onUpdate: (updates: any) => updateNode(newNodeId, updates),
        hidden: true,
        focusRowId: '1',
      },
    };
    // debug logs removed
    addNodeAtPosition(node, x, y);
    requestAnimationFrame(() => {
      try {
        const el = document.querySelector(`.react-flow__node[data-id='${newNodeId}']`) as HTMLElement | null;
        if (!el) { try { console.warn('[DC][mount] node element not found'); } catch {} return; }
        if (!reactFlowInstance || !(reactFlowInstance as any).getViewport) { try { console.warn('[DC][mount] no reactFlowInstance viewport'); } catch {} return; }
        const { zoom } = (reactFlowInstance as any).getViewport();
        const rect = el.getBoundingClientRect();
        const centerNowX = rect.left + rect.width / 2;
        const centerNowY = rect.top + rect.height / 2;
        const dxScreen = clientX - centerNowX;
        const dyScreen = clientY - centerNowY;
        const dxFlow = dxScreen / (zoom || 1);
        const dyFlow = dyScreen / (zoom || 1);
        // debug logs removed
        setNodes((nds) => nds.map(n => n.id === newNodeId ? { ...n, position: { x: (n.position as any).x + dxFlow, y: (n.position as any).y + dyFlow } } : n));
        requestAnimationFrame(() => {
          setNodes((nds) => nds.map(n => n.id === newNodeId ? { ...n, data: { ...(n.data as any), hidden: false } } : n));
          // debug logs removed
        });
      } catch {}
    });
  }, [addNodeAtPosition, nodeIdCounter, reactFlowInstance, setNodes, deleteNodeWithLog, updateNode]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setSelectedEdgeId(null);
    try {
      const ev = new CustomEvent('flow:canvas:click', { bubbles: true });
      window.dispatchEvent(ev);
    } catch {}
  }, []);

  // (rimosso onPaneDoubleClick: usiamo il doppio click sul wrapper)

  const onConnectStart = useCallback((event: any, { nodeId, handleId }: any) => {
    setSource(nodeId || '', handleId || undefined);
  }, []);

  // Rimuove TUTTI i nodi e edge temporanei
  function cleanupAllTempNodesAndEdges() {
    // setNodes((nds) => nds.filter(n => !n.data?.isTemporary));
    setEdges((eds) => removeAllTempEdges(eds, nodesRef.current));
  }

  const onConnectEnd = useCallback((event: any) => {
    // Se subito prima è stata creata una edge reale (onConnect), NON creare il collegamento flottante
    if (pendingEdgeIdRef.current) {
      return;
    }
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
        title: 'Title missing...',
        rows: [],
        onDelete: () => deleteNodeWithLog(newNodeId),
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
  }, [setEdges, nodeIdCounter, onDeleteEdge, updateNode, deleteNodeWithLog, setNodes, reactFlowInstance, connectionMenuRef, nodes]);

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
        rows: [],
        onDelete: () => deleteNodeWithLog(newNodeId),
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
  }, [nodeIdCounter, onDeleteEdge, updateNode, deleteNodeWithLog, setNodes, setEdges, reactFlowInstance, connectionMenuRef, nodes]);

  // Handler robusto per chiusura intellisense/condition menu
  const handleConnectionMenuClose = useCallback(() => {
    // Rimuovi nodo e collegamento temporanei se esistono
    cleanupAllTempNodesAndEdges();
    closeMenu();
  }, [closeMenu]);

  const onNodeDragStart = useCallback((event: any, node: Node) => {
    // Controlla se l'evento è iniziato da un elemento con classe 'nodrag'
    const target = event.target as Element;
    const isAnchor = target && (target.classList.contains('rigid-anchor') || target.closest('.rigid-anchor'));
    if (target && (target.classList.contains('nodrag') || target.closest('.nodrag'))) {
      event.preventDefault();
      return false;
    }
    // Prepara contesto per drag rigido SOLO se partito dall'ancora
    if ((window as any).__flowDragMode === 'rigid' || isAnchor) {
      const rootId = node.id;
      // BFS su edges per raccogliere tutti i discendenti
      const visited = new Set<string>();
      const q: string[] = [rootId];
      visited.add(rootId);
      while (q.length) {
        const cur = q.shift() as string;
        edges.forEach(e => {
          if (e.source === cur && !visited.has(e.target)) {
            visited.add(e.target);
            q.push(e.target);
          }
        });
      }
      // Mappa posizioni iniziali
      const startPositions = new Map<string, { x: number; y: number }>();
      nodes.forEach(n => {
        if (visited.has(n.id)) startPositions.set(n.id, { x: (n.position as any).x, y: (n.position as any).y });
      });
      rigidDragCtxRef.current = {
        rootId,
        ids: visited,
        startPositions,
        rootStart: { x: (node.position as any).x, y: (node.position as any).y },
        rootLast: { x: (node.position as any).x, y: (node.position as any).y },
      };
      // debug logs removed
    } else {
      rigidDragCtxRef.current = null;
    }
  }, []);

  // Rigid drag: se il drag parte con __flowDragMode = 'rigid', muovi anche i discendenti
  const rigidDragCtxRef = useRef<null | { rootId: string; ids: Set<string>; startPositions: Map<string, {x:number;y:number}>; rootStart: {x:number;y:number}; rootLast: {x:number;y:number} }>(null);

  const onNodeDrag = useCallback((event: any, draggedNode: Node) => {
    if (!rigidDragCtxRef.current) return;
    const ctx = rigidDragCtxRef.current;
    if (draggedNode.id !== ctx.rootId) return; // gestiamo solo il root per coerenza delta
    const curX = (draggedNode.position as any).x;
    const curY = (draggedNode.position as any).y;
    const incDx = curX - ctx.rootLast.x;
    const incDy = curY - ctx.rootLast.y;
    // debug logs removed
    if (incDx === 0 && incDy === 0) return;
    setNodes((nds) => nds.map(n => {
      if (!ctx.ids.has(n.id)) return n;
      if (n.id === draggedNode.id) return draggedNode; // root già gestito da RF
      const pos = n.position as any;
      return { ...n, position: { x: pos.x + incDx, y: pos.y + incDy } } as any;
    }));
    ctx.rootLast = { x: curX, y: curY };
  }, [setNodes]);

  const onNodeDragStop = useCallback(() => {
    try { (window as any).__flowDragMode = undefined; } catch {}
    const ctx = rigidDragCtxRef.current;
    if (ctx) {
      // debug logs removed
      // Applica l'offset finale anche se non sono arrivati tick drag
      const rootNow = nodesRef.current.find(n => n.id === ctx.rootId);
      if (rootNow) {
        const finalDx = (rootNow.position as any).x - ctx.rootLast.x;
        const finalDy = (rootNow.position as any).y - ctx.rootLast.y;
        if (finalDx !== 0 || finalDy !== 0) {
          setNodes(nds => nds.map(n => {
            if (!ctx.ids.has(n.id)) return n;
            if (n.id === ctx.rootId) return n;
            const pos = n.position as any;
            return { ...n, position: { x: pos.x + finalDx, y: pos.y + finalDy } } as any;
          }));
        }
      }
    }
    rigidDragCtxRef.current = null;
  }, [setNodes]);

  // Wheel handler: zoom only when CTRL is pressed
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!reactFlowInstance) return;
    if (!e.ctrlKey) {
      // Non zoomare senza CTRL; non chiamare preventDefault su passive listeners
      return;
    }
    // Zoom keeping the cursor screen point fixed
    const vp = (reactFlowInstance as any).getViewport ? (reactFlowInstance as any).getViewport() : { x: 0, y: 0, zoom: 1 };
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.2, Math.min(4, vp.zoom * factor));
    // Convert screen point to flow coordinates before zoom
    const rect = (document.querySelector('.react-flow') as HTMLElement)?.getBoundingClientRect();
    const screenX = e.clientX - (rect ? rect.left : 0);
    const screenY = e.clientY - (rect ? rect.top : 0);
    const flowX = (screenX - vp.x) / vp.zoom;
    const flowY = (screenY - vp.y) / vp.zoom;
    // Compute new pan so the same flow point stays under cursor after zoom
    const newX = screenX - flowX * newZoom;
    const newY = screenY - flowY * newZoom;
    if ((reactFlowInstance as any).setViewport) {
      (reactFlowInstance as any).setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 0 });
    }
  }, [reactFlowInstance]);

  // Cursor tooltip follow mouse
  const cursorTooltipRef = useRef<HTMLDivElement | null>(null);
  const cursorIconRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    el.style.fontSize = '12px';
    el.style.padding = '2px 6px';
    el.style.border = '1px solid #eab308';
    el.style.background = '#fef9c3';
    el.style.color = '#0f172a';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    el.style.display = 'none';
    document.body.appendChild(el);
    cursorTooltipRef.current = el;
    const icon = document.createElement('div');
    icon.style.position = 'fixed';
    icon.style.pointerEvents = 'none';
    icon.style.zIndex = '10000';
    icon.style.width = '14px';
    icon.style.height = '14px';
    icon.style.borderRadius = '50%';
    icon.style.background = '#0ea5e9';
    icon.style.boxShadow = '0 0 0 2px #bae6fd';
    icon.style.display = 'none';
    document.body.appendChild(icon);
    cursorIconRef.current = icon;
    return () => {
      if (cursorTooltipRef.current && cursorTooltipRef.current.parentNode) {
        cursorTooltipRef.current.parentNode.removeChild(cursorTooltipRef.current);
      }
      if (cursorIconRef.current && cursorIconRef.current.parentNode) {
        cursorIconRef.current.parentNode.removeChild(cursorIconRef.current);
      }
      cursorTooltipRef.current = null;
      cursorIconRef.current = null;
    };
  }, []);

  const setCursorTooltip = useCallback((text: string | null, x?: number, y?: number) => {
    const el = cursorTooltipRef.current;
    const icon = cursorIconRef.current;
    if (!el) return;
    if (!text) { el.style.display = 'none'; if (icon) icon.style.display = 'none'; return; }
    el.textContent = text;
    if (typeof x === 'number' && typeof y === 'number') {
      el.style.left = `${x + 12}px`;
      el.style.top = `${y + 12}px`;
      if (icon) { icon.style.left = `${x + 2}px`; icon.style.top = `${y + 2}px`; }
    }
    el.style.display = 'block';
    if (icon) icon.style.display = 'block';
  }, []);

  const handlePaneMouseMove = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isPane = target?.classList?.contains('react-flow__pane') || !!target?.closest?.('.react-flow__pane');
    if (isPane && nodes.length === 0) {
      setCursorTooltip('Double-click to create a node', e.clientX, e.clientY);
    } else {
      setCursorTooltip(null);
    }
  }, [nodes.length, setCursorTooltip]);

  // Fallback: doppio click catturato sul wrapper, valido anche sul primo load
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isPane = target?.classList?.contains('react-flow__pane') || !!target?.closest?.('.react-flow__pane');
    if (!isPane) return;
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX;
    const y = e.clientY;
    // debug logs removed
    createNodeAt(x, y);
  }, [createNodeAt]);

  // Inserter hover: custom cursor + label
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const isInserter = el?.classList?.contains('row-inserter') || !!el?.closest?.('.row-inserter');
      if (isInserter) {
        setCursorTooltip('Click to insert here...', e.clientX, e.clientY);
      } else {
        // Hide only if this effect showed the message
        try {
          const txt = cursorTooltipRef.current?.textContent || '';
          if (txt === 'Click to insert here...') setCursorTooltip(null);
        } catch {}
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove as any);
  }, [setCursorTooltip]);

  // Handler per selezione edge
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
  }, []);

  // Inizializza la viewport a zoom 1 solo al primissimo mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (reactFlowInstance && !initializedRef.current) {
      try { (reactFlowInstance as any).setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 }); } catch {}
      initializedRef.current = true;
    }
  }, [reactFlowInstance]);

  // Stabilizza nodeTypes/edgeTypes per evitare il warning RF#002 (HMR)
  const nodeTypesMemo = React.useMemo(() => ({ custom: CustomNode, task: TaskNode }), []);
  const edgeTypesMemo = React.useMemo(() => ({ custom: CustomEdge }), []);

  return (
    <div className="flex-1 h-full relative" ref={canvasRef} style={{ overflow: 'auto' }} onDoubleClick={handleCanvasDoubleClick} onMouseLeave={() => setCursorTooltip(null)}>
      <ReactFlow
        nodes={nodes}
        edges={edges.map(e => ({ ...e, selected: e.id === selectedEdgeId }))}
        onNodesChange={changes => {
          setNodes(nds => applyNodeChanges(changes, nds));
          // Track selected node ids for grouping
          try {
            const selected = new Set<string>();
            const draft = applyNodeChanges(changes, nodes);
            draft.forEach(n => { if ((n as any).selected) selected.add(n.id); });
            setSelectedNodeIds(Array.from(selected));
          } catch {}
        }}
        onEdgesChange={changes => setEdges(eds => applyEdgeChanges(changes, eds))}
        onConnect={onConnect}
        nodeTypes={nodeTypesMemo}
        edgeTypes={edgeTypesMemo}
        onPaneClick={onPaneClick}
        onMouseMove={handlePaneMouseMove}
        onEdgeClick={handleEdgeClick}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        maxZoom={4}
        className="bg-white"
        style={{ backgroundColor: '#ffffff', width: contentSize.w ? `${contentSize.w}px` : undefined, height: contentSize.h ? `${contentSize.h}px` : undefined }}
        selectionOnDrag={true}
        panOnDrag={[2]}
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnScroll={false}
        onWheel={handleWheel}
        zoomOnDoubleClick={false}
        onMouseUp={(e) => {
          // When user finishes a drag selection, open a contextual menu near the selection centroid
          try {
            if (!reactFlowInstance) return;
            if (selectedNodeIds.length === 0) { setSelectionMenu({ show: false, x: 0, y: 0 }); return; }
            // Use mouse release point relative to the FlowEditor container (account for scroll)
            const host = canvasRef.current;
            const rect = host ? host.getBoundingClientRect() : { left: 0, top: 0 } as any;
            const scrollX = host ? host.scrollLeft : 0;
            const scrollY = host ? host.scrollTop : 0;
            const x = (e.clientX - rect.left) + scrollX;
            const y = (e.clientY - rect.top) + scrollY;
            setSelectionMenu({ show: true, x, y });
          } catch {}
        }}
      >
        <Controls className="bg-white shadow-lg border border-slate-200" />
        <Background 
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.5}
          color="#eef2f7" // puntini molto più sbiaditi
          style={{ backgroundColor: '#ffffff', opacity: 0.6 }}
        />
        <svg style={{ height: 0 }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="6"
              markerHeight="6"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#8b5cf6" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>

      {/* Selection context mini menu at bottom-right of selection */}
      {selectionMenu.show && selectedNodeIds.length >= 1 && (
        <div className="absolute z-20 flex items-center gap-1" style={{ left: selectionMenu.x, top: selectionMenu.y, transform: 'translate(8px, 8px)' }}>
          <button
            className="px-2 py-1 text-xs rounded border bg-white border-slate-300 text-slate-700 shadow-sm"
            onClick={() => {
              try {
                // Compute bounds and centroid
                const sel = nodes.filter(n => selectedNodeIds.includes(n.id));
                if (sel.length === 0) return;
                const minX = Math.min(...sel.map(n => (n.position as any).x));
                const minY = Math.min(...sel.map(n => (n.position as any).y));
                const maxX = Math.max(...sel.map(n => (n.position as any).x));
                const maxY = Math.max(...sel.map(n => (n.position as any).y));
                const cx = (minX + maxX) / 2;
                const cy = (minY + maxY) / 2;

                // Harvest internal edges and external connections
                const selSet = new Set(selectedNodeIds);
                const internalEdges = edges.filter(e => selSet.has(e.source) && selSet.has(e.target));
                const inEdges = edges.filter(e => !selSet.has(e.source) && selSet.has(e.target));
                const outEdges = edges.filter(e => selSet.has(e.source) && !selSet.has(e.target));

                // Build payload
                const payloadNodes = sel.map(n => ({ id: n.id, position: n.position as any, data: { title: (n.data as any)?.title || 'Node', rows: (n.data as any)?.rows || [] } }));
                const payloadEdges = internalEdges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label: (e as any).label || (e.data as any)?.label }));

                // Create a task entity (in-memory)
                // Lazy import to avoid cycle
                import('../../services/ProjectDataService').then(async mod => {
                  const task = await mod.ProjectDataService.addTask('Task', '', { nodes: payloadNodes as any, edges: payloadEdges as any }, {
                    nodeIds: selectedNodeIds,
                    edgeIds: internalEdges.map(e => e.id),
                    entryEdges: inEdges.map(e => e.id),
                    exitEdges: outEdges.map(e => e.id),
                    bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
                  });

                  // Remove internal nodes and edges, insert task node, rewire entry/exit
                  setNodes(nds => {
                    const filtered = nds.filter(n => !selSet.has(n.id));
                    const newNode = { id: `task_${task.id}`, type: 'task' as const, position: { x: cx, y: cy }, data: { title: '', editOnMount: true, showGuide: true, onUpdate: (updates: any) => updateNode(`task_${task.id}`, updates) } };
                    return [...filtered, newNode as any];
                  });
                  setEdges(eds => {
                    let filtered = eds.filter(e => !internalEdges.some(i => i.id === e.id));
                    // Rewire incoming -> task
                    inEdges.forEach(e => {
                      filtered = filtered.map(x => x.id === e.id ? { ...x, target: `task_${task.id}`, targetHandle: e.targetHandle } : x);
                    });
                    // Rewire outgoing <- task
                    outEdges.forEach(e => {
                      filtered = filtered.map(x => x.id === e.id ? { ...x, source: `task_${task.id}`, sourceHandle: e.sourceHandle } : x);
                    });
                    return filtered;
                  });
                  setSelectedNodeIds([]);
                  setSelectionMenu({ show: false, x: 0, y: 0 });
                });
              } catch {}
            }}
          >
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="w-3.5 h-3.5 text-orange-500" />
              Create Task
            </span>
          </button>
        </div>
      )}
      
      {/* Messaggio istruzione in alto a sinistra, solo se canvas vuoto */}
      {nodes.length === 0 && (
        <div
          className="pointer-events-none absolute z-10 text-[10px]"
          style={{ position: 'fixed' as any }}
        >
          
        </div>
      )}
      
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