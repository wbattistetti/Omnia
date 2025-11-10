import React, { useCallback, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  Edge,
  Node,
  BackgroundVariant,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import { debug, error } from '../../utils/logger';
import { CustomNode } from './nodes/CustomNode/CustomNode';
import { TaskNode } from './nodes/TaskNode/TaskNode';
import { useEdgeManager } from '../../hooks/useEdgeManager';
import { useConnectionMenu } from '../../hooks/useConnectionMenu';
import { useNodeManager } from '../../hooks/useNodeManager';
import { useProjectData } from '../../context/ProjectDataContext';
import { useEntityCreation } from '../../hooks/useEntityCreation';
import { dlog } from '../../utils/debug';
import { useNodeCreationLock } from './hooks/useNodeCreationLock';
import { useTemporaryNodes } from './hooks/useTemporaryNodes';
import { useFlowConnect } from './hooks/useFlowConnect';
import { useSelectionManager } from './hooks/useSelectionManager';
import type { NodeData, EdgeData } from './types/flowTypes';
import { useNodesWithLog } from './hooks/useNodesWithLog';
import { useUndoRedoManager } from './hooks/useUndoRedoManager';
import { useEdgeLabelScheduler } from './hooks/useEdgeLabelScheduler';
import { useTempEdgeFlags } from './hooks/useTempEdgeFlags';
import { NodeRegistryProvider } from '../../context/NodeRegistryContext';
import { IntellisenseProvider } from '../../context/IntellisenseContext';
import { IntellisensePopover } from '../Intellisense/IntellisensePopover';
import { SelectionMenu } from './components/SelectionMenu';
// RIMOSSO: import { EdgeConditionMenu } from './components/EdgeConditionMenu';
import { useConditionCreation } from './hooks/useConditionCreation';
import { CustomEdge } from './edges/CustomEdge';
import { v4 as uuidv4 } from 'uuid';
import { useIntellisense } from '../../context/IntellisenseContext';
import { FlowchartWrapper } from './FlowchartWrapper';

// Definizione stabile di nodeTypes and edgeTypes per evitare warning React Flow
const nodeTypes = { custom: CustomNode, task: TaskNode };
const edgeTypes = { custom: CustomEdge };

interface FlowEditorProps {
  flowId?: string;
  onPlayNode: (nodeId: string, nodeRows: any[]) => void;
  nodes: Node<NodeData>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<NodeData>[]>>;
  edges: Edge<EdgeData>[];
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>;
  currentProject: any;
  setCurrentProject: (project: any) => void;
  onCreateTaskFlow?: (flowId: string, title: string, nodes: Node<NodeData>[], edges: Edge<EdgeData>[]) => void;
  onOpenTaskFlow?: (flowId: string, title: string) => void;
}

const FlowEditorContent: React.FC<FlowEditorProps> = ({
  flowId,
  onPlayNode,
  nodes,
  setNodes,
  edges,
  setEdges,
  onCreateTaskFlow,
  onOpenTaskFlow
}) => {
  // Ref sempre aggiornata con lo stato dei nodi
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const [nodeIdCounter, setNodeIdCounter] = useState(3);
  // Crea un ref per nodeIdCounter per matchare la signature expected
  const nodeIdCounterRef = useRef(nodeIdCounter);
  useEffect(() => { nodeIdCounterRef.current = nodeIdCounter; }, [nodeIdCounter]);
  // Sostituisco la gestione connectionMenu con l'hook
  const {
    connectionMenu,
    openMenu,
    closeMenu,
    setTemp,
    connectionMenuRef
  } = useConnectionMenu();
  const reactFlowInstance = useReactFlow();
  // Rimuovo tempEdgeIdState
  const selection = useSelectionManager();
  const { selectedEdgeId, setSelectedEdgeId, selectedNodeIds, setSelectedNodeIds, selectionMenu, setSelectionMenu, handleEdgeClick } = selection;
  // Ref per memorizzare l'ID dell'ultima edge creata (sia tra nodi esistenti che con nodo temporaneo)
  const pendingEdgeIdRef = useRef<string | null>(null);
  // Ref sempre aggiornato con edges correnti (evita closure stale nei deduce temp)
  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Usa l'hook edge manager
  const { patchEdges, deleteEdge: deleteEdgeManaged } = useEdgeManager(setEdges);

  // Sostituisco onDeleteEdge
  const onDeleteEdge = useCallback((edgeId?: string) => {
    if (edgeId) deleteEdgeManaged(edgeId);
  }, [deleteEdgeManaged]);

  // Deferred apply for labels on just-created edges (avoids race with RF state)
  const { scheduleApplyLabel, pendingApplyRef } = useEdgeLabelScheduler(setEdges, setSelectedEdgeId, connectionMenuRef);

  // ✅ Esporta scheduleApplyLabel e setEdges per l'Intellisense
  useEffect(() => {
    (window as any).__scheduleApplyLabel = scheduleApplyLabel;
    (window as any).__setEdges = setEdges;
    return () => {
      delete (window as any).__scheduleApplyLabel;
      delete (window as any).__setEdges;
    };
  }, [scheduleApplyLabel, setEdges]);

  // Helper functions for edge label logic
  const handleExistingEdgeLabel = useCallback((pid: string, label: string) => {
    setEdges(eds => eds.map(e => e.id === pid ? { ...e, label } : e));
    setSelectedEdgeId(pid);
    pendingEdgeIdRef.current = null;
  }, [setEdges, setSelectedEdgeId]);

  const handleTempEdgeStabilization = useCallback((tempNodeId: string, tempEdgeId: string, label: string, fp: any) => {
    debug('FLOW_EDITOR', 'Starting stabilization', { tempNodeId, tempEdgeId, flowPosition: fp, timestamp: Date.now() });

    setNodes(nds => {
      const stabilizedNodes = nds.map(n => {
        if (n.id === tempNodeId) {
          debug('FLOW_EDITOR', 'Stabilizing temporary node', { tempNodeId, pos: n.position, fp, timestamp: Date.now() });
          return { ...n, isTemporary: false };
        }
        return n;
      });
      return stabilizedNodes;
    });

    setEdges(eds => eds.map(e => e.id === tempEdgeId ? { ...e, label } : e));
    setSelectedEdgeId(tempEdgeId);
    closeMenu();
  }, [setNodes, setEdges, setSelectedEdgeId, closeMenu]);

  // Commit helper: apply a label to the current linkage context deterministically
  const commitEdgeLabel = useCallback((label: string): boolean => {
    // 1) Just-created edge between existing nodes
    if (pendingEdgeIdRef.current) {
      const pid = pendingEdgeIdRef.current;
      // If not yet present in state, defer until it appears
      const exists = (edgesRef.current || []).some(e => e.id === pid);
      if (exists) {
        handleExistingEdgeLabel(pid, label);
      } else {
        scheduleApplyLabel(pid, label);
      }
      return true;
    }

    // 2) Promote temp node/edge if present
    const tempNodeId = connectionMenuRef.current.tempNodeId as string | null;
    const tempEdgeId = connectionMenuRef.current.tempEdgeId as string | null;
    if (tempNodeId && tempEdgeId) {
      const fp = (connectionMenuRef.current as any).flowPosition;
      handleTempEdgeStabilization(tempNodeId, tempEdgeId, label, fp);
      return true;
    }

    return false;
  }, [scheduleApplyLabel, handleExistingEdgeLabel, handleTempEdgeStabilization]);

  // Also attempt apply on every edges change (fast path)
  useEffect(() => {
    const cur = pendingApplyRef.current;
    if (!cur) return;
    if ((edges || []).some(e => e.id === cur.id)) {
      setEdges(eds => eds.map(e => e.id === cur.id ? { ...e, label: cur.label, data: cur.data } : e));
      setSelectedEdgeId(cur.id);
      pendingEdgeIdRef.current = null;
    }
  }, [edges, setEdges]);

  // --- Undo/Redo command stack ---
  const { undo, redo } = useUndoRedoManager();
  // Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Y or Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((window as any).__debugCanvas) {
        try { console.log('[CanvasDbg][doc.capture]', { key: e.key, target: (e.target as HTMLElement)?.className, defaultPrevented: e.defaultPrevented }); } catch { }
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) { redo(); } else { undo(); }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler as any, { capture: true } as any);
  }, [undo, redo]);

  // Lock interno per prevenire duplicazioni durante la creazione dei nodi
  const isCreatingTempNode = useRef(false);

  // Wrapper per setNodes con logging dettagliato e lock interno
  const setNodesWithLog = useNodesWithLog(setNodes);

  // ✅ Spostare PRIMA la definizione di deleteNode
  const { deleteNode, updateNode, addNodeAtPosition: originalAddNodeAtPosition } = useNodeManager(setNodesWithLog, setNodeIdCounter);

  // ✅ Poi definire deleteNodeWithLog (CORREGGERE il nome)
  const deleteNodeWithLog = useCallback((id: string) => {
    deleteNode(id);
  }, [deleteNode]);

  // ✅ Definire addNodeAtPosition wrapper
  const addNodeAtPosition = useCallback((node: Node<NodeData>, x: number, y: number) => {
    originalAddNodeAtPosition(node, x, y);
  }, [originalAddNodeAtPosition]);

  // Hook centralizzato per la creazione di entità (solo se il context è pronto)
  const entityCreation = useEntityCreation();
  const { createAgentAct, createBackendCall, createMacrotask, createTask, createCondition } = entityCreation;

  // Adapter functions per matchare le signature expected da useFlowConnect
  const createAgentActAdapter = useCallback(() => {
    createAgentAct(''); // Solo name, scope opzionale
  }, [createAgentAct]);

  const createBackendCallAdapter = useCallback(() => {
    createBackendCall(''); // Solo name, scope opzionale
  }, [createBackendCall]);

  const createTaskAdapter = useCallback(() => {
    createMacrotask(''); // Solo name, scope opzionale
  }, [createMacrotask]);

  // Sostituisco onConnect
  const { onConnect, onConnectStart } = useFlowConnect(
    reactFlowInstance,
    connectionMenuRef,
    setNodes,
    setEdges,
    nodesRef,
    closeMenu,
    onDeleteEdge,
    deleteNodeWithLog,
    updateNode,
    createAgentActAdapter,
    createBackendCallAdapter,
    createTaskAdapter,
    nodeIdCounterRef
  );

  // RIMOSSO: useEffect inutile che causava loop infinito

  // Aggiungi gli hook per ProjectData (per la creazione di condizioni)
  // ✅ RIMOSSO: addItem e addCategory - ora usati direttamente in useConditionCreation
  const { data: projectData } = useProjectData();


  // ✅ RIMOSSO: problemIntentSeedItems - ora calcolato manualmente in openIntellisense

  // Ottieni tutte le condizioni disponibili dal project data
  const allConditions = React.useMemo(() => {
    try {
      const conditions = (projectData as any)?.conditions || [];
      const conditionItems = conditions.flatMap((category: any) =>
        (category.items || []).map((item: any) => ({
          label: item.name || 'Unknown',
          value: item.id || 'unknown',
          description: item.description || ''
        }))
      );
      return conditionItems.length > 0 ? conditionItems : undefined;
    } catch (error) {
      return undefined;
    }
  }, [projectData]);

  // ✅ PRIMA: Inizializza tempFlags (necessario per useConditionCreation)
  const tempFlags = useTempEdgeFlags();

  // ✅ PRIMA: Definisci removeAllTempEdges (necessario per useConditionCreation)
  const removeAllTempEdges = useCallback((eds: Edge[], currentNodes: Node[]) => {
    const filtered = eds.filter(e => {
      const targetNode = currentNodes.find(n => n.id === e.target);
      const isTemp = !!(targetNode && targetNode.data && targetNode.data.isTemporary);
      return !isTemp;
    });
    return filtered;
  }, []);

  // ✅ Usa hook per gestione creazione nuova condizione
  const { handleCreateCondition } = useConditionCreation(
    setEdges,
    setSelectedEdgeId,
    connectionMenuRef,
    reactFlowInstance,
    nodesRef,
    setNodes,
    deleteNodeWithLog,
    updateNode,
    createAgentAct,
    createBackendCall,
    createTask,
    createCondition,
    nodeIdCounter,
    setNodeIdCounter,
    pendingEdgeIdRef,
    closeMenu,
    tempFlags,
    setNodesWithLog,
    removeAllTempEdges,
    edges,
    onDeleteEdge
  );

  // Patch all edges after mount
  React.useEffect(() => {
    patchEdges();
  }, [patchEdges]);

  // Update existing nodes with callbacks and onPlayNode
  React.useEffect(() => {
    // Solo aggiorna se ci sono nodi da aggiornare
    if (nodes.length > 0) {
      setNodes((nds) => {
        return nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            onDelete: () => deleteNodeWithLog(node.id),
            onUpdate: (updates: any) => updateNode(node.id, updates),
            onPlayNode: onPlayNode ? () => onPlayNode(node.id, node.data.rows) : undefined,
            onCreateAgentAct: createAgentAct,
            onCreateBackendCall: createBackendCall,
            onCreateTask: createTask,
            onCreateCondition: createCondition,
          },
        }));
      });
    }
  }, [deleteNodeWithLog, updateNode, setNodes, onPlayNode, createAgentAct, createBackendCall, createTask, nodes.length]);

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

  const createNodeAt = useCallback((clientX: number, clientY: number, initialRow?: any) => {
    // Usa UUID invece del contatore per evitare conflitti
    const newNodeId = uuidv4();

    let x = 0, y = 0;
    if (reactFlowInstance) {
      // ✅ clientX, clientY sono le coordinate schermo del clone (position: fixed)
      // ✅ Converti direttamente in coordinate flow
      const pos = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
      x = pos.x;
      y = pos.y;
    }

    const focusRowId = initialRow ? initialRow.id : `${newNodeId}-${Math.random().toString(36).substr(2, 9)}`;

    const node: Node<NodeData> = {
      id: newNodeId,
      type: 'custom',
      position: { x, y },
      data: {
        title: '',
        rows: initialRow ? [initialRow] : [],
        onDelete: () => deleteNodeWithLog(newNodeId),
        onUpdate: (updates: any) => updateNode(newNodeId, updates),
        hidden: false, // ✅ Visibile subito - la posizione è già corretta
        focusRowId: focusRowId,
        isTemporary: true,
      },
    };
    // ✅ Aggiungi il nodo - fine, niente retry, niente attese DOM
    addNodeAtPosition(node, x, y);
  }, [addNodeAtPosition, reactFlowInstance, deleteNodeWithLog, updateNode]);

  // ✅ Listener per creare un nodo dal canvas quando si rilascia una riga
  useEffect(() => {
    const handleCreateNodeFromRow = (event: CustomEvent) => {
      const { rowData, cloneScreenPosition } = event.detail;

      if (!rowData || !cloneScreenPosition) {
        return;
      }

      // ✅ Crea il nodo posizionandolo esattamente dove è il clone (coordinate schermo convertite in flow)
      createNodeAt(cloneScreenPosition.x, cloneScreenPosition.y, rowData);
    };

    window.addEventListener('createNodeFromRow', handleCreateNodeFromRow as EventListener);
    return () => {
      window.removeEventListener('createNodeFromRow', handleCreateNodeFromRow as EventListener);
    };
  }, [createNodeAt]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setSelectedEdgeId(null);

    // Disabilitata la cancellazione automatica dei nodi al click canvas (gestita da CustomNode)
    // nodes.forEach(() => {});

    try {
      const ev = new CustomEvent('flow:canvas:click', { bubbles: true });
      window.dispatchEvent(ev);
    } catch { }
  }, [nodes, deleteNodeWithLog]);

  // (rimosso onPaneDoubleClick: usiamo il doppio click sul wrapper)

  // ✅ RIMUOVERE le funzioni locali:
  // - cleanupAllTempNodesAndEdges (righe 814-841)
  // - createTemporaryNode (righe 874-942)
  // e sostituire con:
  const { cleanupAllTempNodesAndEdges, createTemporaryNode } = useTemporaryNodes(
    setNodes,
    setEdges,
    reactFlowInstance,
    connectionMenuRef,
    onDeleteEdge,
    setNodesWithLog,
    isCreatingTempNode
  );

  // ✅ Esporta cleanup per l'Intellisense (DOPO la definizione)
  useEffect(() => {
    (window as any).__cleanupAllTempNodesAndEdges = cleanupAllTempNodesAndEdges;
    return () => {
      delete (window as any).__cleanupAllTempNodesAndEdges;
    };
  }, [cleanupAllTempNodesAndEdges]);

  // Promuove il nodo/edge temporanei a definitivi e rimuove ogni altro temporaneo residuo
  // ✅ RIMOSSA: function finalizeTempPromotion - non utilizzata

  const withNodeLock = useNodeCreationLock();

  // ✅ NUOVO: Hook per aprire intellisense
  const { state, actions: intellisenseActions } = useIntellisense();
  console.debug('[FlowEditor] useIntellisense returned:', {
    hasActions: !!intellisenseActions,
    hasOpenForEdge: !!intellisenseActions?.openForEdge,
    openForEdgeType: typeof intellisenseActions?.openForEdge,
    isFunction: typeof intellisenseActions?.openForEdge === 'function'
  });


  const onConnectEnd = useCallback((event: any) => {
    const target = event.target as HTMLElement;
    const isPane = target?.classList?.contains('react-flow__pane');

    console.log("🎬🎬🎬 [ON_CONNECT_END] Dettagli completi:", {
      targetClassName: target?.className,
      targetTag: target?.tagName,
      isPane,
      hasPendingEdge: !!pendingEdgeIdRef.current,
      hasSourceNode: !!connectionMenuRef.current.sourceNodeId,
      sourceNodeId: connectionMenuRef.current.sourceNodeId,
      sourceHandleId: connectionMenuRef.current.sourceHandleId,
      dragStartedFromHandle: dragStartedFromHandleRef.current,
      timestamp: Date.now()
    });

    // ✅ Reset flag connessione quando si rilascia
    if ((window as any).__isConnecting) {
      console.log('🔄 [ON_CONNECT_END] Reset flag __isConnecting');
      (window as any).__isConnecting = false;
    }

    // ✅ NOTA: Con noDragClassName, onNodeDragStart non viene chiamato quando si parte da un handle,
    // quindi questo controllo non dovrebbe essere necessario, ma lo lasciamo come sicurezza
    if (dragStartedFromHandleRef.current) {
      dragStartedFromHandleRef.current = false;
      cleanupAllTempNodesAndEdges();
      return;
    }

    // Se subito prima è stata creata una edge reale (onConnect), NON creare il collegamento flottante
    if (pendingEdgeIdRef.current) {
      console.log("⏭️ [ON_CONNECT_END] Skipping - pending edge exists");
      return;
    }

    const targetIsPane = (event.target as HTMLElement)?.classList?.contains('react-flow__pane');

    console.log("🔍 [ON_CONNECT_END] Conditions check", {
      targetIsPane,
      hasSourceNode: !!connectionMenuRef.current.sourceNodeId,
      willCreateNode: targetIsPane && !!connectionMenuRef.current.sourceNodeId
    });

    if (targetIsPane && connectionMenuRef.current.sourceNodeId) {
      console.log("🚀 [ON_CONNECT_END] Starting node creation with lock");
      // ✅ FIX: Usa il lock asincrono enterprise-ready
      withNodeLock(async () => {
        try {
          console.log("📍 [ON_CONNECT_END] About to call createTemporaryNode");
          const result = await createTemporaryNode(event);
          console.log("✅ [ON_CONNECT_END] createTemporaryNode returned", result);
          const { tempNodeId, tempEdgeId } = result;
          console.log("🎯 [ON_CONNECT_END] About to call openForEdge with EDGE:", { edgeId: tempEdgeId });
          // ✅ Pass mouse coordinates to openForEdge
          if (intellisenseActions?.openForEdge) {
            intellisenseActions.openForEdge(tempEdgeId);
            console.log("🎯 [ON_CONNECT_END] openForEdge() call completed with mouse coordinates:", {
              mouseX: result.mouseX,
              mouseY: result.mouseY
            });
          } else {
            console.error("❌ [ON_CONNECT_END] intellisenseActions.openForEdge is undefined!");
          }
        } catch (error) {
          console.error("❌ [ON_CONNECT_END] Error creating temporary node:", error);
        }
      });
    } else {
      // Solo se NON stiamo creando un nodo, pulisci i temporanei
      console.log("❌ [ON_CONNECT_END] Not creating node - conditions not met, cleaning up");
      cleanupAllTempNodesAndEdges();
    }
  }, [withNodeLock, createTemporaryNode, openMenu, cleanupAllTempNodesAndEdges, pendingEdgeIdRef, intellisenseActions]);

  // Utility per rimuovere edge temporaneo
  // ✅ RIMOSSA: function removeTempEdge - non utilizzata

  // Una edge è temporanea se il suo target è un nodo temporaneo (usando lo stato più recente dei nodi)
  // ✅ RIMOSSO: removeAllTempEdges - ora definito prima per useConditionCreation

  // Rimuovi completamente handleSelectCondition e handleConnectionMenuClose
  // Queste funzioni erano legate a EdgeConditionMenu che è stato rimosso

  // Handler robusto per chiusura intellisense/condition menu
  // ✅ RIMOSSA: const handleConnectionMenuClose - non utilizzata

  const onNodeDragStart = useCallback((event: any, node: Node) => {
    // ✅ Con nodesDraggable={false}, questo non dovrebbe essere chiamato per drag normale
    // Solo quando attiviamo manualmente il drag dalla toolbar
    const target = event.target as Element;
    const isAnchor = target && (target.classList.contains('rigid-anchor') || target.closest('.rigid-anchor'));
    const isHandle = target && (
      target.classList.contains('react-flow__handle') ||
      target.closest('.react-flow__handle')
    );
    const hasNodrag = target && (target.classList.contains('nodrag') || target.closest('.nodrag'));
    const isToolbarDrag = (window as any).__isToolbarDrag === node.id;

    // ✅ Se viene chiamato con un handle, blocca
    if (isHandle) {
      dragStartedFromHandleRef.current = true;
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    dragStartedFromHandleRef.current = false;

    // ✅ BLOCCA se ha nodrag E non è un drag dalla toolbar
    if (hasNodrag && !isToolbarDrag) {
      (window as any).__blockNodeDrag = node.id;
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    // ✅ Permetti solo se è un drag dalla toolbar
    if (isToolbarDrag) {
      (window as any).__blockNodeDrag = null;
    } else {
      // ✅ Se non è toolbar drag, blocca (non dovrebbe succedere con nodesDraggable={false})
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    (window as any).__blockNodeDrag = null;
    // Prepara contesto per drag rigido SOLO se partito dall'ancora
    if ((window as any).__flowDragMode === 'rigid' || isAnchor) {
      console.log('🚀 [DRAG DEBUG] RIGID DRAG DETECTED - setting up rigid drag context');
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
      console.log('🚀 [DRAG DEBUG] RIGID DRAG CONTEXT SET - descendants found:', visited.size);
    } else {
      console.log('🚀 [DRAG DEBUG] NORMAL DRAG - no rigid context');
      rigidDragCtxRef.current = null;
    }
  }, []);

  // Rigid drag: se il drag parte con __flowDragMode = 'rigid', muovi anche i discendenti
  const rigidDragCtxRef = useRef<null | { rootId: string; ids: Set<string>; startPositions: Map<string, { x: number; y: number }>; rootStart: { x: number; y: number }; rootLast: { x: number; y: number } }>(null);

  // ✅ Ref per tracciare se il drag è partito da un handle
  const dragStartedFromHandleRef = useRef<boolean>(false);

  // Helper functions for rigid drag logic
  const applyRigidDragMovement = useCallback((ctx: any, draggedNode: Node, setNodes: any) => {
    if (draggedNode.id !== ctx.rootId) return;
    const curX = (draggedNode.position as any).x;
    const curY = (draggedNode.position as any).y;
    const incDx = curX - ctx.rootLast.x;
    const incDy = curY - ctx.rootLast.y;
    if (incDx === 0 && incDy === 0) return;

    setNodes((nds: Node<NodeData>[]) => nds.map(n => {
      if (!ctx.ids.has(n.id)) return n;
      if (n.id === draggedNode.id) return draggedNode;
      const pos = n.position as any;
      return { ...n, position: { x: pos.x + incDx, y: pos.y + incDy } } as any;
    }));

    ctx.rootLast = { x: curX, y: curY };
  }, []);

  const applyFinalRigidDragOffset = useCallback((ctx: any, nodesRef: any, setNodes: any) => {
    const rootNow = nodesRef.current.find((n: Node) => n.id === ctx.rootId);
    if (rootNow) {
      const finalDx = (rootNow.position as any).x - ctx.rootLast.x;
      const finalDy = (rootNow.position as any).y - ctx.rootLast.y;
      if (finalDx !== 0 || finalDy !== 0) {
        setNodes((nds: Node<NodeData>[]) => nds.map(n => {
          if (!ctx.ids.has(n.id)) return n;
          if (n.id === ctx.rootId) return n;
          const pos = n.position as any;
          return { ...n, position: { x: pos.x + finalDx, y: pos.y + finalDy } } as any;
        }));
      }
    }
  }, []);

  const onNodeDrag = useCallback((event: any, draggedNode: Node) => {
    const isBlocked = (window as any).__blockNodeDrag === draggedNode.id;
    console.log('🔥🔥🔥 [ON_NODE_DRAG] NODO IN MOVIMENTO:', {
      nodeId: draggedNode.id,
      currentPosition: draggedNode.position,
      dragStartedFromHandle: dragStartedFromHandleRef.current,
      hasRigidContext: !!rigidDragCtxRef.current,
      eventType: event.type,
      blockedByNodrag: isBlocked,
      blockFlag: (window as any).__blockNodeDrag,
      timestamp: Date.now()
    });

    // ✅ Blocca il drag se è partito da un elemento nodrag
    if (isBlocked) {
      console.log('🚫🚫🚫 [ON_NODE_DRAG] DRAG BLOCCATO - nodrag element detected, resetting position');
      // Annulla il movimento ripristinando la posizione originale
      const originalNode = nodes.find(n => n.id === draggedNode.id);
      if (originalNode) {
        console.log('🚫 [ON_NODE_DRAG] Resetting node position from', draggedNode.position, 'to', originalNode.position);
        setNodes((nds) => nds.map((n) =>
          n.id === draggedNode.id ? { ...n, position: originalNode.position } : n
        ));
        console.log('🚫 [ON_NODE_DRAG] Position reset - returning early');
      } else {
        console.warn('⚠️ [ON_NODE_DRAG] Original node not found, cannot reset position');
      }
      return;
    }

    // ✅ Se il drag è partito da un handle, NON DOVREBBE ESSERE QUI
    if (dragStartedFromHandleRef.current) {
      console.error('❌❌❌ [ON_NODE_DRAG] PROBLEMA: Nodo in movimento ma drag partito da handle!', {
        nodeId: draggedNode.id,
        timestamp: Date.now()
      });
      return;
    }

    if (!rigidDragCtxRef.current) {
      return;
    }
    const ctx = rigidDragCtxRef.current;
    applyRigidDragMovement(ctx, draggedNode, setNodes);
  }, [setNodes, applyRigidDragMovement]);

  const onNodeDragStop = useCallback((event: any, node: Node) => {
    // ✅ NOTA: onNodeDragStop NON viene chiamato quando si parte da un handle
    // grazie a noDragClassName="react-flow__handle"
    try { (window as any).__flowDragMode = undefined; } catch { }

    const ctx = rigidDragCtxRef.current;
    if (ctx) {
      applyFinalRigidDragOffset(ctx, nodesRef, setNodes);
    }
    rigidDragCtxRef.current = null;
  }, [setNodes, applyFinalRigidDragOffset, nodesRef]);

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

  // Persisted selection rectangle (keeps the user-drawn area after mouseup)
  const [persistedSel, setPersistedSel] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const dragStartRef = useRef<null | { x: number; y: number }>(null);

  // Fallback: doppio click catturato sul wrapper, valido anche sul primo load
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Solo se il doppio click avviene DIRETTAMENTE sul pane (non dentro nodi)
    const isPane = target?.classList?.contains('react-flow__pane');
    if (!isPane) return;
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX;
    const y = e.clientY;
    // debug logs removed
    createNodeAt(x, y);
  }, [createNodeAt]);

  // Hide tooltip when first node is created
  useEffect(() => {
    if (nodes.length > 0) {
      setCursorTooltip(null);
    }
  }, [nodes.length, setCursorTooltip]);

  // Inserter hover: custom cursor + label
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const isInserter = el?.classList?.contains('row-inserter') || !!el?.closest?.('.row-inserter');

      // Disabilita il tooltip durante il drag delle righe
      const isDraggingRow = document.querySelector('.node-row-outer[data-being-dragged="true"]');

      // Disabilita anche se c'è un elemento trascinato fisso
      const isDraggedElement = document.querySelector('[key*="dragged-"]');

      if (isInserter && !isDraggingRow && !isDraggedElement) {
        setCursorTooltip('Click to insert here...', e.clientX, e.clientY);
      } else {
        // Hide only if this effect showed the message
        try {
          const txt = cursorTooltipRef.current?.textContent || '';
          if (txt === 'Click to insert here...') setCursorTooltip(null);
        } catch { }
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove as any);
  }, [setCursorTooltip]);

  // Inizializza la viewport a zoom 1 solo al primissimo mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (reactFlowInstance && !initializedRef.current) {
      try { (reactFlowInstance as any).setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 }); } catch { }
      initializedRef.current = true;
    }
  }, [reactFlowInstance]);

  // ✅ SOLUZIONE DEFINITIVA: Forza la griglia a coprire tutto il canvas con CSS semplice
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'flowchart-grid-fix';
    style.textContent = `
      .react-flow__node[draggable="true"] * {
        border: 2px solid red !important;
      }
      /* ✅ Forza la griglia a coprire infinito in tutte le direzioni con position fixed */
      .react-flow__background {
        position: fixed !important;
        top: -50% !important;
        left: -50% !important;
        width: 200% !important;
        height: 200% !important;
        pointer-events: none !important;
        z-index: 0 !important;
      }
      .react-flow__background svg {
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById('flowchart-grid-fix');
      if (existing) document.head.removeChild(existing);
    };
  }, []);

  // ✅ RIMOSSO: Il debug non serve più - la soluzione è solo CSS sopra
  /*useEffect(() => {
    const analyzeBackground = () => {
      const backgroundEl = document.querySelector('.react-flow__background') as HTMLElement | null;
      const svgEl = backgroundEl?.querySelector('svg') as SVGSVGElement | null;
      const patternEl = svgEl?.querySelector('pattern') as SVGPatternElement | null;
      const reactFlowEl = document.querySelector('.react-flow') as HTMLElement | null;
      const paneEl = document.querySelector('.react-flow__pane') as HTMLElement | null;
      const canvasRefEl = canvasRef.current as HTMLElement | null;

      // Log completo della struttura (solo una volta per evitare spam)
      if (!(window as any).__gridDebugLogged) {
        console.log('🔍 [GRID DEBUG] Background Analysis:', {
          background: {
            exists: !!backgroundEl,
            width: backgroundEl?.offsetWidth,
            height: backgroundEl?.offsetHeight,
            computedWidth: backgroundEl ? window.getComputedStyle(backgroundEl).width : null,
            computedHeight: backgroundEl ? window.getComputedStyle(backgroundEl).height : null,
            position: backgroundEl ? window.getComputedStyle(backgroundEl).position : null,
            top: backgroundEl ? window.getComputedStyle(backgroundEl).top : null,
            left: backgroundEl ? window.getComputedStyle(backgroundEl).left : null,
            backgroundColor: backgroundEl ? window.getComputedStyle(backgroundEl).backgroundColor : null,
            innerHTML: backgroundEl ? backgroundEl.innerHTML.substring(0, 200) : null,
          },
          svg: {
            exists: !!svgEl,
            width: svgEl?.width.baseVal.value,
            height: svgEl?.height.baseVal.value,
            viewBox: svgEl?.viewBox.baseVal ? {
              x: svgEl.viewBox.baseVal.x,
              y: svgEl.viewBox.baseVal.y,
              width: svgEl.viewBox.baseVal.width,
              height: svgEl.viewBox.baseVal.height,
            } : null,
            fill: svgEl ? window.getComputedStyle(svgEl).fill : null,
            innerHTML: svgEl ? svgEl.innerHTML.substring(0, 500) : null,
          },
          pattern: {
            exists: !!patternEl,
            width: patternEl?.width.baseVal.value,
            height: patternEl?.height.baseVal.value,
            patternUnits: patternEl?.patternUnits,
            patternUnitsAttr: patternEl?.getAttribute('patternUnits'),
            x: patternEl?.x.baseVal.value,
            y: patternEl?.y.baseVal.value,
          },
          reactFlow: {
            exists: !!reactFlowEl,
            width: reactFlowEl?.offsetWidth,
            height: reactFlowEl?.offsetHeight,
            backgroundColor: reactFlowEl ? window.getComputedStyle(reactFlowEl).backgroundColor : null,
          },
          pane: {
            exists: !!paneEl,
            width: paneEl?.offsetWidth,
            height: paneEl?.offsetHeight,
            backgroundColor: paneEl ? window.getComputedStyle(paneEl).backgroundColor : null,
          },
          canvas: {
            exists: !!canvasRefEl,
            width: canvasRefEl?.offsetWidth,
            height: canvasRefEl?.offsetHeight,
            scrollWidth: canvasRefEl?.scrollWidth,
            scrollHeight: canvasRefEl?.scrollHeight,
          }
        });
        (window as any).__gridDebugLogged = true;
      }

      // ✅ Cerca tutti i pattern possibili (anche in altri SVG o nel documento)
      const allPatterns = document.querySelectorAll('pattern');
      console.log('🔍 [GRID DEBUG] All patterns found:', {
        count: allPatterns.length,
        patterns: Array.from(allPatterns).map((p, i) => ({
          index: i,
          id: p.id,
          width: (p as SVGPatternElement).width.baseVal.value,
          height: (p as SVGPatternElement).height.baseVal.value,
          patternUnits: (p as SVGPatternElement).patternUnits,
          parent: p.parentElement?.tagName,
        }))
      });

      // ✅ Cerca anche in defs
      const allDefs = document.querySelectorAll('defs');
      console.log('🔍 [GRID DEBUG] All defs found:', {
        count: allDefs.length,
        defs: Array.from(allDefs).map((d, i) => ({
          index: i,
          parent: d.parentElement?.tagName,
          children: Array.from(d.children).map(c => c.tagName),
        }))
      });

      // ✅ Modifica il pattern SVG per renderlo infinito
      // Prova prima quello trovato nel background, poi tutti gli altri
      let patternToModify = patternEl;

      if (!patternToModify && allPatterns.length > 0) {
        // Se non trovato nel background, usa il primo pattern disponibile
        patternToModify = allPatterns[0] as SVGPatternElement;
      }

      if (patternToModify) {
        const patternUnitsValue = patternToModify.getAttribute('patternUnits') || 'objectBoundingBox';
        const currentWidth = patternToModify.width.baseVal.value;
        const currentHeight = patternToModify.height.baseVal.value;
        const TARGET_SIZE = 10000;

        // ✅ Evita loop: controlla diversamente in base a patternUnits
        if (patternUnitsValue === 'objectBoundingBox') {
          // Con objectBoundingBox, controlla le dimensioni dell'SVG invece
          if (svgEl) {
            const svgWidth = svgEl.width.baseVal.value;
            const svgHeight = svgEl.height.baseVal.value;
            if (svgWidth >= 5000 && svgHeight >= 5000) {
              // SVG già modificato, non fare nulla per evitare loop
              return;
            }
          }
        } else {
          // Con userSpaceOnUse, controlla le dimensioni del pattern
          if (currentWidth >= TARGET_SIZE && currentHeight >= TARGET_SIZE) {
            // Pattern già modificato, non fare nulla per evitare loop
            return;
          }
        }

        const originalWidth = currentWidth;
        const originalHeight = currentHeight;

        console.log('🔧 [GRID DEBUG] Modifying pattern:', {
          id: patternToModify.id,
          originalWidth,
          originalHeight,
          before: {
            width: currentWidth,
            height: currentHeight,
            patternUnits: patternToModify.patternUnits,
          }
        });

        // ✅ IMPORTANTE: Con patternUnits="objectBoundingBox", le dimensioni sono relative (0-1)
        // Quindi non possiamo semplicemente aumentare le dimensioni!
        // Dobbiamo modificare l'SVG o il background container invece
        try {
          const patternUnitsValue = patternToModify.getAttribute('patternUnits') || 'objectBoundingBox';
          console.log('🔧 [GRID DEBUG] Pattern units:', patternUnitsValue);

          if (patternUnitsValue === 'objectBoundingBox') {
            // Con objectBoundingBox, le dimensioni sono relative - non possiamo aumentarle
            // Invece, modifichiamo l'SVG del background per renderlo più grande
            console.log('⚠️ [GRID DEBUG] Pattern uses objectBoundingBox - cannot increase pattern size directly');
            console.log('🔧 [GRID DEBUG] Will modify SVG/background container instead');

            // NON modificare il pattern - lascialo com'è
            // Invece modifichiamo l'SVG o il background container
            if (svgEl) {
              const currentSvgWidth = svgEl.width.baseVal.value;
              const currentSvgHeight = svgEl.height.baseVal.value;

              console.log('🔧 [GRID DEBUG] SVG current dimensions:', {
                width: currentSvgWidth,
                height: currentSvgHeight,
                viewBox: svgEl.viewBox.baseVal ? {
                  width: svgEl.viewBox.baseVal.width,
                  height: svgEl.viewBox.baseVal.height,
                } : null,
              });

              // Aumenta le dimensioni dell'SVG se è troppo piccolo
              // IMPORTANTE: Usa valori molto grandi per coprire tutto il canvas
              const SVG_TARGET_SIZE = 20000; // Molto più grande per coprire tutto

              if (currentSvgWidth < SVG_TARGET_SIZE || currentSvgHeight < SVG_TARGET_SIZE) {
                const oldWidth = svgEl.width.baseVal.value;
                const oldHeight = svgEl.height.baseVal.value;

                svgEl.width.baseVal.value = SVG_TARGET_SIZE;
                svgEl.height.baseVal.value = SVG_TARGET_SIZE;

                // Aggiorna anche il viewBox se esiste
                if (svgEl.viewBox.baseVal) {
                  svgEl.setAttribute('viewBox', `0 0 ${SVG_TARGET_SIZE} ${SVG_TARGET_SIZE}`);
                }

                console.log('✅ [GRID DEBUG] SVG enlarged:', {
                  before: { width: oldWidth, height: oldHeight },
                  after: {
                    width: svgEl.width.baseVal.value,
                    height: svgEl.height.baseVal.value,
                    viewBox: svgEl.viewBox.baseVal ? {
                      width: svgEl.viewBox.baseVal.width,
                      height: svgEl.viewBox.baseVal.height,
                    } : null,
                  },
                });

                // ✅ Monitora se React Flow resetta l'SVG
                setTimeout(() => {
                  const checkWidth = svgEl.width.baseVal.value;
                  const checkHeight = svgEl.height.baseVal.value;
                  if (checkWidth !== SVG_TARGET_SIZE || checkHeight !== SVG_TARGET_SIZE) {
                    console.warn('⚠️ [GRID DEBUG] SVG was reset by React Flow!', {
                      expected: { width: SVG_TARGET_SIZE, height: SVG_TARGET_SIZE },
                      actual: { width: checkWidth, height: checkHeight },
                    });
                    // Ri-applica la modifica
                    svgEl.width.baseVal.value = SVG_TARGET_SIZE;
                    svgEl.height.baseVal.value = SVG_TARGET_SIZE;
                  }
                }, 100);
              }
            }

            // Modifica anche il background container CSS
            if (backgroundEl) {
              const bgStyle = window.getComputedStyle(backgroundEl);
              console.log('🔧 [GRID DEBUG] Background container before:', {
                width: bgStyle.width,
                height: bgStyle.height,
                position: bgStyle.position,
                backgroundColor: bgStyle.backgroundColor,
                overflow: bgStyle.overflow,
              });

              // Forza dimensioni molto grandi anche sul container
              (backgroundEl as HTMLElement).style.width = '20000px';
              (backgroundEl as HTMLElement).style.height = '20000px';
              (backgroundEl as HTMLElement).style.position = 'absolute';
              (backgroundEl as HTMLElement).style.top = '-50%';
              (backgroundEl as HTMLElement).style.left = '-50%';

              console.log('✅ [GRID DEBUG] Background container CSS modified');
            }
          } else {
            // Con userSpaceOnUse, possiamo aumentare le dimensioni
            patternToModify.width.baseVal.value = TARGET_SIZE;
            patternToModify.height.baseVal.value = TARGET_SIZE;

            console.log('✅ [GRID DEBUG] Pattern modified (userSpaceOnUse):', {
              id: patternToModify.id,
              after: {
                width: patternToModify.width.baseVal.value,
                height: patternToModify.height.baseVal.value,
                patternUnits: patternToModify.patternUnits,
                patternUnitsAttr: patternToModify.getAttribute('patternUnits'),
              }
            });
          }
        } catch (e) {
          console.error('❌ [GRID DEBUG] Error modifying pattern:', e);
        }
      } else {
        console.warn('⚠️ [GRID DEBUG] Pattern element not found - trying to modify SVG directly');

        // ✅ Se non c'è pattern, prova a modificare direttamente l'SVG
        if (svgEl) {
          const svgWidth = svgEl.width.baseVal.value;
          const svgHeight = svgEl.height.baseVal.value;

          console.log('🔧 [GRID DEBUG] Modifying SVG directly:', {
            before: {
              width: svgWidth,
              height: svgHeight,
            }
          });

          try {
            // Prova a impostare dimensioni molto grandi
            svgEl.width.baseVal.value = 10000;
            svgEl.height.baseVal.value = 10000;

            console.log('✅ [GRID DEBUG] SVG modified:', {
              after: {
                width: svgEl.width.baseVal.value,
                height: svgEl.height.baseVal.value,
              }
            });
          } catch (e) {
            console.error('❌ [GRID DEBUG] Error modifying SVG:', e);
          }
        }
      }
    };

    // Esegui analisi dopo un breve delay per permettere al DOM di renderizzare
    const timeout = setTimeout(analyzeBackground, 100);

    // ✅ Usa MutationObserver per monitorare quando React Flow rigenera il pattern
    // Con debounce per evitare loop infiniti
    let reanalysisTimeout: NodeJS.Timeout | null = null;
    const observer = new MutationObserver((mutations) => {
      let shouldReanalyze = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          // Se cambia il pattern o l'SVG, ri-analizza
          const target = mutation.target as HTMLElement;
          if (target.tagName === 'pattern' || target.tagName === 'svg' || target.classList.contains('react-flow__background')) {
            // Verifica se qualcosa è stato resettato
            if (target.tagName === 'pattern') {
              const pattern = target as SVGPatternElement;
              const patternUnits = pattern.getAttribute('patternUnits') || 'objectBoundingBox';
              if (patternUnits === 'objectBoundingBox') {
                // Con objectBoundingBox, controlla l'SVG
                const svg = target.closest('svg') as SVGSVGElement | null;
                if (svg && (svg.width.baseVal.value < 5000 || svg.height.baseVal.value < 5000)) {
                  shouldReanalyze = true;
                  console.log('🔄 [GRID DEBUG] SVG reset detected');
                }
              } else {
                // Con userSpaceOnUse, controlla il pattern
                if (pattern.width.baseVal.value < 10000 || pattern.height.baseVal.value < 10000) {
                  shouldReanalyze = true;
                  console.log('🔄 [GRID DEBUG] Pattern reset detected');
                }
              }
            } else if (target.tagName === 'svg') {
              const svg = target as SVGSVGElement;
              if (svg.width.baseVal.value < 5000 || svg.height.baseVal.value < 5000) {
                shouldReanalyze = true;
                console.log('🔄 [GRID DEBUG] SVG reset detected');
              }
            } else {
              shouldReanalyze = true;
            }
          }
        }
      });
      if (shouldReanalyze) {
        // Debounce: aspetta 200ms prima di ri-analizzare
        if (reanalysisTimeout) {
          clearTimeout(reanalysisTimeout);
        }
        reanalysisTimeout = setTimeout(() => {
          console.log('🔄 [GRID DEBUG] DOM changed, re-analyzing...');
          analyzeBackground();
        }, 200);
      }
    });

    // Osserva il background e tutti gli SVG per cambiamenti
    const backgroundEl = document.querySelector('.react-flow__background');
    if (backgroundEl) {
      observer.observe(backgroundEl, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['width', 'height', 'patternUnits', 'viewBox']
      });
    }

    // Esegui anche quando cambia il viewport o si fa resize
    window.addEventListener('resize', analyzeBackground);
    window.addEventListener('scroll', analyzeBackground, { passive: true });

    return () => {
      clearTimeout(timeout);
      if (reanalysisTimeout) {
        clearTimeout(reanalysisTimeout);
      }
      observer.disconnect();
      window.removeEventListener('resize', analyzeBackground);
      window.removeEventListener('scroll', analyzeBackground);
    };
  }, [reactFlowInstance, nodes.length]);*/


  return (
    <div
      className="flex-1 h-full relative"
      ref={canvasRef}
      onDoubleClick={handleCanvasDoubleClick}
      onMouseLeave={() => setCursorTooltip(null)}
      onMouseDown={(e) => {
        const tgt = e.target as HTMLElement;
        const isPane = tgt?.classList?.contains('react-flow__pane') || !!tgt?.closest?.('.react-flow__pane');
        if (!isPane) return;
        // reset previous persisted rectangle and store start in canvas coords (including scroll)
        setPersistedSel(null);
        const host = canvasRef.current;
        if (!host) return;
        const rect = host.getBoundingClientRect();
        const sx = (e.clientX - rect.left) + host.scrollLeft;
        const sy = (e.clientY - rect.top) + host.scrollTop;
        dragStartRef.current = { x: sx, y: sy };
      }}
    >
      {/* Expose nodes/edges to GlobalDebuggerPanel (bridge) */}
      {(() => { try { (window as any).__flowNodes = nodes; (window as any).__flowEdges = edges; if (flowId) { (window as any).__flows = (window as any).__flows || {}; (window as any).__flows[flowId] = { nodes, edges }; } } catch { } return null; })()}

      <FlowchartWrapper
        nodes={nodes}
        edges={edges}
        padding={400}
        minWidth={1200}
        minHeight={800}
      >
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
            } catch { }
          }}
          onEdgesChange={changes => setEdges(eds => applyEdgeChanges(changes, eds))}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onPaneClick={onPaneClick}
          onMouseMove={handlePaneMouseMove}
          onEdgeClick={handleEdgeClick}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          noDragClassName="react-flow__handle nodrag"
          nodesDraggable={false}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={(e, node) => {
            if (node?.type === 'task') {
              e.preventDefault();
              e.stopPropagation();
              const flowId = (node.data as any)?.flowId || node.id;
              const title = (node.data as any)?.title || 'Task';
              if (onOpenTaskFlow) onOpenTaskFlow(flowId, title);
            }
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          maxZoom={4}
          className="bg-white"
          style={{ backgroundColor: '#ffffff', width: '100%', height: '100%' }}
          selectionOnDrag={true}
          onSelectionChange={(sel) => {
            try {
              const ids = Array.isArray(sel?.nodes) ? sel.nodes.map((n: any) => n.id) : [];
              setSelectedNodeIds(ids);
              // Debug selezione solo su flag esplicito
              dlog('flow', '[selectionChange]', { count: ids.length });
              // verifica presenza del rettangolo di selezione e stili calcolati
              setTimeout(() => {
                try {
                  const el = document.querySelector('.react-flow__selection') as HTMLElement | null;
                  if (el) {
                    const cs = getComputedStyle(el);
                    dlog('flow', '[selectionRect]', { bg: cs.backgroundColor });
                  }
                } catch { }
              }, 0);
            } catch { }
          }}
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
              // Usa la selezione live per evitare ritardi di stato
              const liveNodes: any[] = (reactFlowInstance as any).getNodes ? (reactFlowInstance as any).getNodes() : nodes;
              const liveSelectedIds = (liveNodes || []).filter(n => n?.selected).map(n => n.id);
              const effSelected = liveSelectedIds.length ? liveSelectedIds : selectedNodeIds;
              if (effSelected.length < 2) { setSelectionMenu({ show: false, x: 0, y: 0 }); return; }
              // sincronizza anche lo state locale, per coerenza
              try { if (liveSelectedIds.length) setSelectedNodeIds(liveSelectedIds); } catch { }
              // Use mouse release point relative to the FlowEditor container (account for scroll)
              const host = canvasRef.current;
              const rect = host ? host.getBoundingClientRect() : { left: 0, top: 0 } as any;
              const scrollX = host ? host.scrollLeft : 0;
              const scrollY = host ? host.scrollTop : 0;
              const x = (e.clientX - rect.left) + scrollX;
              const y = (e.clientY - rect.top) + scrollY;
              setSelectionMenu({ show: true, x, y });
            } catch { }
            // Persist the selection rectangle exactly as drawn
            try {
              const start = dragStartRef.current;
              dragStartRef.current = null;
              const host = canvasRef.current;
              if (start && host) {
                const rect = host.getBoundingClientRect();
                const ex = (e.clientX - rect.left) + host.scrollLeft;
                const ey = (e.clientY - rect.top) + host.scrollTop;
                const x = Math.min(start.x, ex);
                const y = Math.min(start.y, ey);
                const w = Math.abs(ex - start.x);
                const h = Math.abs(ey - start.y);
                if (w > 3 && h > 3) setPersistedSel({ x, y, w, h }); else setPersistedSel(null);
              }
            } catch { }
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
      </FlowchartWrapper>

      {persistedSel && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: persistedSel.x,
            top: persistedSel.y,
            width: persistedSel.w,
            height: persistedSel.h,
            backgroundColor: 'rgba(125, 211, 252, 0.18)',
            border: '1px solid rgba(56, 189, 248, 0.9)',
            boxShadow: '0 0 0 1px rgba(56,189,248,0.25) inset',
            zIndex: 5
          }}
        />
      )}

      {/* Selection context mini menu at bottom-right of selection */}
      {selectionMenu.show && selectedNodeIds.length >= 2 && (
        <SelectionMenu
          selectedNodeIds={selectedNodeIds}
          selectionMenu={selectionMenu}
          onCreateTask={() => {
            if (selectedNodeIds.length < 2) return;

            console.log('🎯 [CREATE_TASK] Starting task creation from', selectedNodeIds.length, 'selected nodes');

            // 1. SALVA la selezione originale per rollback
            const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
            const selectedEdges = edges.filter(e =>
              selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
            );
            const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
            const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

            // 2. Crea ID unico per il task flow e il task node
            const newFlowId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const taskNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const editingToken = `edit_${Date.now()}`; // Token immutabile per triggare editing

            console.log('🎯 [CREATE_TASK] Task node will be created at:', { x: avgX, y: avgY, id: taskNodeId, flowId: newFlowId });
            console.log('🎯 [CREATE_TASK] Saved original selection:', { nodes: selectedNodes.length, edges: selectedEdges.length });

            // 3. NASCONDE i nodi selezionati (ma non li elimina ancora)
            setNodes(nds => nds.map(n =>
              selectedNodeIds.includes(n.id)
                ? { ...n, hidden: true }
                : n
            ));

            // 4. NASCONDE gli edges selezionati
            setEdges(eds => eds.map(e =>
              (selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target))
                ? { ...e, hidden: true }
                : e
            ));

            // 5. Crea il nodo Task in editing (NON crea ancora il flow)
            const taskNode: Node<any> = {
              id: taskNodeId,
              type: 'task',
              position: { x: avgX, y: avgY },
              data: {
                title: '', // Vuoto all'inizio, sarà editato dall'utente
                flowId: newFlowId,
                editingToken, // Token immutabile per triggare editing immediato
                onUpdate: (updates: any) => {
                  console.log('🎯 [TASK_UPDATE] Task node data updated:', updates);
                  setNodes(nds => nds.map(n =>
                    n.id === taskNodeId
                      ? { ...n, data: { ...n.data, ...updates } }
                      : n
                  ));
                },
                onCancelTitle: () => {
                  console.log('🎯 [TASK_CANCEL] Task creation cancelled, restoring original selection');

                  // ✅ ROLLBACK: Rimuovi il task node
                  setNodes(nds => nds.filter(n => n.id !== taskNodeId));

                  // ✅ ROLLBACK: Ripristina i nodi nascosti
                  setNodes(nds => nds.map(n =>
                    selectedNodeIds.includes(n.id)
                      ? { ...n, hidden: false }
                      : n
                  ));

                  // ✅ ROLLBACK: Ripristina gli edges nascosti
                  setEdges(eds => eds.map(e =>
                    (selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target))
                      ? { ...e, hidden: false }
                      : e
                  ));

                  console.log('🎯 [TASK_CANCEL] Original selection restored');
                },
                onCommitTitle: (title: string) => {
                  console.log('🎯 [TASK_COMMIT] Task title committed:', title);

                  // ✅ FINALIZZA: SOLO ORA elimina i nodi nascosti
                  setNodes(nds => nds.filter(n => !selectedNodeIds.includes(n.id)));

                  // ✅ FINALIZZA: SOLO ORA elimina gli edges
                  setEdges(eds => eds.filter(e =>
                    !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
                  ));

                  // ✅ FINALIZZA: SOLO ORA crea il flow
                  if (onCreateTaskFlow) {
                    console.log('🎯 [TASK_COMMIT] Creating task flow:', newFlowId);
                    onCreateTaskFlow(newFlowId, title, selectedNodes, selectedEdges);
                  }

                  // ✅ FINALIZZA: SOLO ORA apre la tab
                  if (onOpenTaskFlow) {
                    console.log('🎯 [TASK_COMMIT] Opening task flow tab:', title);
                    onOpenTaskFlow(newFlowId, title);
                  }

                  console.log('🎯 [TASK_COMMIT] Task finalized successfully');
                }
              }
            };

            console.log('🎯 [CREATE_TASK] Adding task node to flow (in editing mode)');
            setNodes(nds => [...nds, taskNode]);

            // 6. Chiudi il menu di selezione
            setSelectionMenu({ show: false, x: 0, y: 0 });
            setSelectedNodeIds([]);

            console.log('🎯 [CREATE_TASK] Task node created, waiting for user input');
          }}
          onCancel={() => setSelectionMenu({ show: false, x: 0, y: 0 })}
        />
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
        <div
          className="absolute pointer-events-none"
          style={{
            left: connectionMenu.position.x,
            top: connectionMenu.position.y,
            width: 0,
            height: 0,
            backgroundColor: 'rgba(125, 211, 252, 0.18)',
            border: '1px solid rgba(56, 189, 248, 0.9)',
            boxShadow: '0 0 0 1px rgba(56,189,248,0.25) inset',
            zIndex: 5
          }}
        />
      )}
      {/* ✅ RIMOSSO: IntellisenseMenu inline - ora gestito da IntellisensePopover */}
    </div>
  );
};

// Ref globale per edge temporaneo
// ✅ RIMOSSO: const tempEdgeIdGlobal - non utilizzato

// Flag per tracciare nodi temporanei stabilizzati (per evitare riposizionamento)
// ✅ RIMOSSO: const stabilizedTempNodes - non utilizzato

// Flag per tracciare nodi temporanei in corso di creazione (per evitare creazione duplicata)
// ✅ RIMOSSO: const creatingTempNodes - non utilizzato

export const FlowEditor: React.FC<FlowEditorProps> = (props) => {
  console.debug('[FlowEditor] Component mounted');

  const { data: projectData } = useProjectData();

  // Providers per IntellisenseService
  const intellisenseProviders = React.useMemo(() => ({
    getProjectData: () => projectData,
    getFlowNodes: () => (window as any).__flowNodes || [],
    getFlowEdges: () => (window as any).__flowEdges || [],
  }), [projectData]);

  return (
    <NodeRegistryProvider>
      <IntellisenseProvider providers={intellisenseProviders}>
        <ReactFlowProvider>
          <FlowEditorContent {...props} />
          <IntellisensePopover />
        </ReactFlowProvider>
      </IntellisenseProvider>
    </NodeRegistryProvider>
  );
};
