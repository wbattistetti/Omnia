import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
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
import { useNodeAlignment } from './hooks/useNodeAlignment';
import type { FlowNode, EdgeData } from './types/flowTypes';
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
import { useEdgeDataManager } from './hooks/useEdgeDataManager';
import { useFlowEventHandlers } from './hooks/useFlowEventHandlers';
import { useFlowViewport } from './hooks/useFlowViewport';
import { useCursorTooltip } from './hooks/useCursorTooltip';
import { useEdgeLabelManager } from './hooks/useEdgeLabelManager';
import { useTaskCreationFromSelection } from './hooks/useTaskCreationFromSelection';
import { CustomEdge } from './edges/CustomEdge';
import { v4 as uuidv4 } from 'uuid';
import { useIntellisense } from '../../context/IntellisenseContext';
import { FlowchartWrapper } from './FlowchartWrapper';
import { ExecutionStateProvider } from './executionHighlight/ExecutionStateContext';
import { taskRepository } from '../../services/TaskRepository';
import { getTaskIdFromRow } from '../../utils/taskHelpers';

// Definizione stabile di nodeTypes and edgeTypes per evitare warning React Flow
const nodeTypes = { custom: CustomNode, task: TaskNode };
const edgeTypes = { custom: CustomEdge };

interface FlowEditorProps {
  flowId?: string;
  onPlayNode: (nodeId: string, nodeRows: any[]) => void;
  nodes: Node<FlowNode>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNode>[]>>;
  edges: Edge<EdgeData>[];
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>;
  currentProject: any;
  setCurrentProject: (project: any) => void;
  onCreateTaskFlow?: (flowId: string, title: string, nodes: Node<FlowNode>[], edges: Edge<EdgeData>[]) => void;
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
  onOpenTaskFlow,
  executionState: propExecutionState,
  currentTask: propCurrentTask,
  isRunning: propIsRunning
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

  // Node alignment and distribution
  const { handleAlign, handleDistribute, checkAlignmentOverlap, checkDistributionOverlap } = useNodeAlignment(
    nodes,
    setNodes,
    setSelectionMenu
  );
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

  // ✅ Use Edge Data Manager hook for safe edge data updates
  const { createOnUpdate } = useEdgeDataManager(setEdges, onDeleteEdge);

  // Store callbacks in refs to avoid dependency issues in useEffect
  const createOnUpdateRef = useRef(createOnUpdate);
  const onDeleteEdgeRef = useRef(onDeleteEdge);
  useEffect(() => {
    createOnUpdateRef.current = createOnUpdate;
    onDeleteEdgeRef.current = onDeleteEdge;
  }, [createOnUpdate, onDeleteEdge]);

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

  // 🎨 [HIGHLIGHT] Log execution state changes (only when values change)
  const prevStateRef = useRef<{ currentNodeId?: string | null; executedCount?: number; isRunning?: boolean }>({});
  useEffect(() => {
    const execState = propExecutionState ?? (window as any).__executionState ?? null;
    const task = propCurrentTask ?? (window as any).__currentTask ?? null;
    const running = propIsRunning ?? (window as any).__isRunning ?? false;

    const prev = prevStateRef.current;
    const current = {
      currentNodeId: execState?.currentNodeId,
      executedCount: execState ? execState.executedTaskIds.size : 0,
      isRunning: running
    };

    // Only log if values actually changed
    if (
      running && (
        prev.currentNodeId !== current.currentNodeId ||
        prev.executedCount !== current.executedCount ||
        prev.isRunning !== current.isRunning ||
        !prev.isRunning // Log on first run
      )
    ) {
      // Log removed - only isElse logs are kept
      prevStateRef.current = current;
    }
  }, [propExecutionState, propCurrentTask, propIsRunning]);

  // ✅ Use Edge Label Manager hook
  const { commitEdgeLabel } = useEdgeLabelManager({
    edges,
    setEdges,
    setSelectedEdgeId,
    pendingEdgeIdRef,
    edgesRef,
    connectionMenuRef,
    scheduleApplyLabel,
    pendingApplyRef,
    closeMenu,
    setNodes,
  });

  // --- Undo/Redo command stack ---
  const { undo, redo } = useUndoRedoManager();
  // Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Y or Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((window as any).__debugCanvas) {
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

  // ✅ Definire addNodeAtPosition wrapper
  const addNodeAtPosition = useCallback((node: Node<FlowNode>, x: number, y: number) => {
    originalAddNodeAtPosition(node, x, y);
  }, [originalAddNodeAtPosition]);

  // Hook centralizzato per la creazione di entità (solo se il context è pronto)
  const entityCreation = useEntityCreation();
  const { createFactoryTask, createBackendCall, createMacrotask, createTask, createCondition } = entityCreation; // ✅ RINOMINATO: createAgentAct → createFactoryTask

  // Adapter functions per matchare le signature expected da useFlowConnect
  const createFactoryTaskAdapter = useCallback(() => {
    createFactoryTask(''); // Solo name, scope opzionale
  }, [createFactoryTask]); // ✅ RINOMINATO: createAgentActAdapter → createFactoryTaskAdapter

  const createBackendCallAdapter = useCallback(() => {
    createBackendCall(''); // Solo name, scope opzionale
  }, [createBackendCall]);

  const createTaskAdapter = useCallback(() => {
    createMacrotask(''); // Solo name, scope opzionale
  }, [createMacrotask]);

  // RIMOSSO: useEffect inutile che causava loop infinito

  // Aggiungi gli hook per ProjectData (per la creazione di condizioni)
  // ✅ RIMOSSO: addItem e addCategory - ora usati direttamente in useConditionCreation
  const { data: projectData } = useProjectData();

  // ✅ Definisci deleteNodeWithLog dopo projectData
  const deleteNodeWithLog = useCallback(async (id: string) => {
    // ✅ NUOVO: Cancella tutti i task delle righe del nodo prima di cancellare il nodo
    try {
      // Trova il nodo prima di cancellarlo
      const nodeToDelete = nodes.find(n => n.id === id);
      if (nodeToDelete && nodeToDelete.data?.rows) {
        const rows = nodeToDelete.data.rows as any[];
        // ✅ Ottieni projectId da useProjectData
        const projectId = projectData?.projectId || undefined;

        console.log(`🗑️ [deleteNodeWithLog] Cancellando nodo ${id} con ${rows.length} righe`);

        // Cancella tutti i task delle righe
        for (const row of rows) {
          const taskId = row?.taskId || getTaskIdFromRow(row) || row?.id; // row.id è anche il taskId
          if (taskId) {
            try {
              await taskRepository.deleteTask(taskId, projectId);
              console.log(`✅ [deleteNodeWithLog] Task ${taskId} cancellato per riga ${row.id}`);

              // ✅ Emit event to close Response Editor if open for this task
              document.dispatchEvent(new CustomEvent('taskEditor:closeIfOpen', {
                detail: { taskId }
              }));
            } catch (e) {
              console.warn(`⚠️ [deleteNodeWithLog] Errore cancellando task ${taskId}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error('❌ [deleteNodeWithLog] Errore durante cancellazione task:', e);
    }

    // Cancella il nodo
    deleteNode(id);
  }, [deleteNode, nodes, projectData]);

  // Sostituisco onConnect (dopo deleteNodeWithLog)
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
    createFactoryTaskAdapter, // ✅ RINOMINATO: createAgentActAdapter → createFactoryTaskAdapter
    createBackendCallAdapter,
    createTaskAdapter,
    nodeIdCounterRef,
    createOnUpdate
  );

  // ✅ RIMOSSO: problemIntentSeedItems - ora calcolato manualmente in openIntellisense

  // Ottieni tutte le condizioni disponibili dal project data
  const allConditions = useMemo(() => {
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
    createFactoryTask, // ✅ RINOMINATO: createAgentAct → createFactoryTask
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
  useEffect(() => {
    patchEdges();
  }, [patchEdges]);

  // Update existing nodes with callbacks and onPlayNode
  useEffect(() => {
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
            onCreateFactoryTask: createFactoryTask, // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
            onCreateBackendCall: createBackendCall,
            onCreateTask: createTask,
            onCreateCondition: createCondition,
          },
        }));
      });
    }
  }, [deleteNodeWithLog, updateNode, setNodes, onPlayNode, createFactoryTask, createBackendCall, createTask, nodes.length]); // ✅ RINOMINATO: createAgentAct → createFactoryTask

  // ✅ Initialize edges with onUpdate/onDeleteEdge if missing (for existing edges loaded from saved project)
  // This is different from the old useEffect: it only adds missing callbacks, doesn't recreate edges
  // Use a ref to track which edges have been initialized to prevent infinite loops
  const initializedEdgeIdsRef = useRef<Set<string>>(new Set());
  const previousEdgeIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Create a set of current edge IDs
    const currentEdgeIds = new Set(edges.map(e => e.id));

    // Check if any new edges were added (not just re-renders)
    const newEdgeIds = new Set([...currentEdgeIds].filter(id => !previousEdgeIdsRef.current.has(id)));

    // Update previous edge IDs for next comparison
    previousEdgeIdsRef.current = currentEdgeIds;

    // Only check edges that are new OR haven't been initialized yet
    const edgesNeedingInit = edges.filter(e =>
      e.type === 'custom' &&
      (newEdgeIds.has(e.id) || !initializedEdgeIdsRef.current.has(e.id)) &&
      (!e.data?.onUpdate || !e.data?.onDeleteEdge)
    );

    if (edgesNeedingInit.length === 0) {
      return; // No edges need initialization
    }

    console.log('[FlowEditor][useEffect] 🔧 Initializing missing edge callbacks', {
      totalEdges: edges.length,
      edgesNeedingInit: edgesNeedingInit.length
    });

    setEdges(eds => {
      let hasChanges = false;
      const updatedEdges = eds.map(e => {
        if (e.type === 'custom' && edgesNeedingInit.some(ne => ne.id === e.id)) {
          const existingData = e.data || {};
          const needsOnUpdate = !existingData.onUpdate;
          const needsOnDeleteEdge = !existingData.onDeleteEdge;

          if (needsOnUpdate || needsOnDeleteEdge) {
            hasChanges = true;
            initializedEdgeIdsRef.current.add(e.id); // Mark as initialized

            console.log('[FlowEditor][useEffect] 🔧 Adding missing callbacks to edge', {
              edgeId: e.id,
              needsOnUpdate,
              needsOnDeleteEdge,
              existingDataKeys: Object.keys(existingData)
            });

            return {
              ...e,
              data: {
                ...existingData, // Preserve ALL existing data (linkStyle, labelPositionSvg, controlPoints, etc.)
                ...(needsOnUpdate && { onUpdate: createOnUpdateRef.current(e.id) }),
                ...(needsOnDeleteEdge && { onDeleteEdge: onDeleteEdgeRef.current })
              }
            };
          }
        }
        return e;
      });

      return hasChanges ? updatedEdges : eds; // Only return new array if there were changes
    });
  }, [edges, setEdges]); // Depend on edges array, but use refs to track which ones we've processed

  // Forza tutti gli edge a solidi dopo il mount o ogni volta che edges cambiano
  useEffect(() => {
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

    const node: Node<FlowNode> = {
      id: newNodeId,
      type: 'custom',
      position: { x, y },
      data: {
        label: '',
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

  // ✅ REMOVED: onPaneClick - now in useFlowEventHandlers

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
    isCreatingTempNode,
    createOnUpdate
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
    // ✅ Reset flag connessione quando si rilascia
    if ((window as any).__isConnecting) {
      (window as any).__isConnecting = false;
    }

    // ✅ NOTA: Con noDragClassName, onNodeDragStart non viene chiamato quando si parte da un handle,
    // quindi questo controllo non dovrebbe essere necessario, ma lo lasciamo come sicurezza
    if ((window as any).__dragStartedFromHandle) {
      (window as any).__dragStartedFromHandle = false;
      cleanupAllTempNodesAndEdges();
      return;
    }

    // Se subito prima è stata creata una edge reale (onConnect), NON creare il collegamento flottante
    if (pendingEdgeIdRef.current) {
      return;
    }

    const targetIsPane = (event.target as HTMLElement)?.classList?.contains('react-flow__pane');

    if (targetIsPane && connectionMenuRef.current.sourceNodeId) {
      // ✅ FIX: Usa il lock asincrono enterprise-ready
      withNodeLock(async () => {
        try {
          const result = await createTemporaryNode(event);
          const { tempEdgeId } = result;
          // ✅ Pass mouse coordinates to openForEdge
          if (intellisenseActions?.openForEdge) {
            intellisenseActions.openForEdge(tempEdgeId);
          }
        } catch (error) {
          // Silent fail
        }
      });
    } else {
      // Solo se NON stiamo creando un nodo, pulisci i temporanei
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

  // ✅ REMOVED: onNodeDragStart, onNodeDrag, onNodeDragStop, rigidDragCtxRef, dragStartedFromHandleRef
  // ✅ REMOVED: applyRigidDragMovement, applyFinalRigidDragOffset
  // All moved to useFlowEventHandlers hook

  // ✅ Use Flow Viewport hook for zoom, pan, and scroll-to-node
  const { handleWheel } = useFlowViewport(reactFlowInstance);

  // ✅ Use Cursor Tooltip hook
  const { setCursorTooltip } = useCursorTooltip(nodes.length);

  // Persisted selection rectangle (keeps the user-drawn area after mouseup)
  const [persistedSel, setPersistedSel] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const dragStartRef = useRef<null | { x: number; y: number }>(null);

  // ✅ Use Flow Event Handlers hook
  const eventHandlers = useFlowEventHandlers(
    reactFlowInstance,
    nodes,
    edges,
    setNodes,
    setSelectedEdgeId,
    setSelectedNodeIds,
    setSelectionMenu,
    setCursorTooltip,
    createNodeAt,
    canvasRef,
    dragStartRef,
    setPersistedSel,
    selectedNodeIds,
    onOpenTaskFlow
  );

  // ✅ Use Task Creation from Selection hook
  const { handleCreateTask } = useTaskCreationFromSelection({
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectionMenu,
    setSelectedNodeIds,
    onCreateTaskFlow,
    onOpenTaskFlow,
  });

  // ✅ REMOVED: Viewport initialization and scroll-to-node logic
  // All moved to useFlowViewport hook

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
      onDoubleClick={eventHandlers.handleCanvasDoubleClick}
      onMouseLeave={() => setCursorTooltip(null)}
      onMouseDown={eventHandlers.onMouseDown}
    >
      {/* Expose nodes/edges to GlobalDebuggerPanel (bridge) */}
      {(() => { try { (window as any).__flowNodes = nodes; (window as any).__flowEdges = edges; if (flowId) { (window as any).__flows = (window as any).__flows || {}; (window as any).__flows[flowId] = { nodes, edges }; } } catch { } return null; })()}

      {/* Execution State Provider - Pass execution state from props or window */}
      {/* Also expose edges to window for edge highlighting */}
      {(() => {
        try {
          (window as any).__flowEdges = edges;
        } catch { }
        return null;
      })()}
      <ExecutionStateProvider
        executionState={propExecutionState ?? (window as any).__executionState ?? null}
        currentTask={propCurrentTask ?? (window as any).__currentTask ?? null}
        isRunning={propIsRunning ?? (window as any).__isRunning ?? false}
      >
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
            onPaneClick={eventHandlers.onPaneClick}
            onMouseMove={eventHandlers.handlePaneMouseMove}
            onEdgeClick={handleEdgeClick}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            noDragClassName="react-flow__handle nodrag"
            nodesDraggable={false}
            onNodeDragStart={eventHandlers.onNodeDragStart}
            onNodeDrag={eventHandlers.onNodeDrag}
            onNodeDragStop={eventHandlers.onNodeDragStop}
            onNodeDoubleClick={eventHandlers.onNodeDoubleClick}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            maxZoom={4}
            className="bg-white"
            style={{ backgroundColor: '#ffffff', width: '100%', height: '100%' }}
            selectionOnDrag={true}
            onSelectionChange={eventHandlers.onSelectionChange}
            panOnDrag={[2]}
            zoomOnScroll={false}
            zoomOnPinch={false}
            panOnScroll={false}
            onWheel={handleWheel}
            zoomOnDoubleClick={false}
            onMouseUp={eventHandlers.onMouseUp}
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
      </ExecutionStateProvider>

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
          nodes={nodes}
          onCreateTask={() => handleCreateTask(selectedNodeIds)}
          onAlign={(type) => handleAlign(type, selectedNodeIds)}
          onDistribute={(type) => handleDistribute(type, selectedNodeIds)}
          checkAlignmentOverlap={(type) => checkAlignmentOverlap(type, selectedNodeIds)}
          checkDistributionOverlap={(type) => checkDistributionOverlap(type, selectedNodeIds)}
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
  const intellisenseProviders = useMemo(() => ({
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
