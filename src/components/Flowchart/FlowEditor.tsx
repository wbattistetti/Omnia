import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  Edge,
  Node,
  Connection,
  BackgroundVariant,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  useStoreApi,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { debug, error as logError } from '../../utils/logger';
import { CustomNode } from './nodes/CustomNode/CustomNode';
import { TaskNode } from './nodes/TaskNode/TaskNode';
import { FlowSubflowProvider } from './context/FlowSubflowContext';
import { FlowCanvasProvider } from './context/FlowCanvasContext';
import { useEdgeManager } from '../../hooks/useEdgeManager';
import { useConnectionMenu } from '../../hooks/useConnectionMenu';
import { useNodeManager } from '../../hooks/useNodeManager';
import { useNodeActions } from '../../hooks/useNodeActions'; // Phase 3
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
import { IntellisensePopover } from '../Intellisense/IntellisensePopover';
import { SelectionMenu } from './components/SelectionMenu';
import { useConditionCreation } from './hooks/useConditionCreation';
import { useFlowEventHandlers } from './hooks/useFlowEventHandlers';
import { useFlowViewport } from './hooks/useFlowViewport';
import { useCursorTooltip } from './hooks/useCursorTooltip';
import { useTaskCreationFromSelection } from './hooks/useTaskCreationFromSelection';
import { CustomEdge } from './edges/CustomEdge';
import { IntellisenseProvider, useIntellisense } from '../../context/IntellisenseContext';
import { FlowchartWrapper } from './FlowchartWrapper';
import { ReactFlowContainerResize } from './reactFlowContainerResize';
import { useFlowCanvasShellReady } from './hooks/useFlowCanvasShellReady';
import { FlowPanZoomOverview } from './panZoom/FlowPanZoomOverview';
import {
  omniaFlowBackgroundPatternId,
  omniaFlowReactFlowId,
} from './flowReactFlowInstanceIds';
import { ExecutionStateProvider } from './executionHighlight/ExecutionStateContext';
import { FlowStateBridge } from '../../services/FlowStateBridge';
import { useCompilationErrors } from '../../context/CompilationErrorsContext';
import { useFlowchartState } from '../../context/FlowchartStateContext';
import { useCrossFlowRowMoveOrchestrator } from './hooks/useCrossFlowRowMoveOrchestrator';
import { useCrossNodeSubflowPortalMove } from './hooks/useCrossNodeSubflowPortalMove';
import { VHV_COLLINEAR_EPS_PX } from './edges/utils/edgeRouting';
import { waitForHandleBounds } from './utils/waitForHandleBounds';
import { diagFlowLink } from './utils/flowTempLinkDiag';
import { computeLinkMidScreenFromConnection } from './utils/computeLinkMidScreenFromConnection';
import { computeLinkMidScreenForTempEdgeUnified } from './utils/edgeIntellisenseAnchorFromHandles';
import { incrementEditorOpenMetric } from '@features/performance';
import { resolveVariableStoreProjectId } from '@utils/safeProjectId';
import {
  useElevenLabsFlowDrop,
  type ElevenLabsFlowDropMessage,
} from './hooks/useElevenLabsFlowDrop';
import { useFlowCanvasSemanticBridge } from './hooks/useFlowCanvasSemanticBridge';
import {
  emitViewportInitialFit,
  emitViewportSettled,
  subscribeFlowCanvasSemantic,
} from './semantic/flowCanvasSemanticEvents';
import { keepFlowGraphInView } from './utils/flowViewportKeepGraphVisible';

// Edge types stabile per evitare warning React Flow
const edgeTypes = { custom: CustomEdge };

interface FlowEditorProps {
  flowId?: string;
  // ✅ REMOVED: onPlayNode - now using FlowTestContext instead of prop drilling
  nodes: Node<FlowNode>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNode>[]>>;
  edges: Edge<EdgeData>[];
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>;
  currentProject: any;
  setCurrentProject: (project: any) => void;
  onCreateTaskFlow?: (flowId: string, title: string, nodes: Node<FlowNode>[], edges: Edge<EdgeData>[]) => void;
  onOpenTaskFlow?: (flowId: string, title: string) => void;
  /** Opens a subflow tab for a Flow-type row (taskId, optional existingFlowId, optional title = row label, optional canvas node id) */
  onOpenSubflowForTask?: (taskId: string, existingFlowId?: string, title?: string, canvasNodeId?: string) => void;
}

const FlowEditorContent: React.FC<FlowEditorProps> = ({
  flowId,
  nodes,
  setNodes,
  edges,
  setEdges,
  onCreateTaskFlow,
  onOpenTaskFlow,
  onOpenSubflowForTask,
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
  const { updateNodeInternals } = reactFlowInstance;
  const storeApi = useStoreApi();
  const flowCanvasId = String(flowId ?? 'main').trim();
  const selection = useSelectionManager();

  const { selectedEdgeId, setSelectedEdgeId, selectedNodeIds, setSelectedNodeIds, selectionMenu, setSelectionMenu, handleEdgeClick } = selection;

  // ✅ COMPILATION ERRORS: Get errors from context (already reactive - no sync needed)
  const { errors: compilationErrors } = useCompilationErrors();

  // ✅ FLOWCHART STATE: Sync nodes with context
  const { setNodes: setContextNodes } = useFlowchartState();

  useEffect(() => {
    setContextNodes(nodes);
  }, [nodes, setContextNodes]);

  const nodeTypes = useMemo(() => ({ custom: CustomNode, task: TaskNode }), []);

  // ✅ ERROR SIDEBAR: Removed - errors are always visible on nodes/edges, not in optional sidebar

  // ✅ Handle error click - select node and center viewport
  const handleErrorClick = useCallback((error: import('../../FlowCompiler/types').CompilationError) => {
    if (error.nodeId) {
      // Select node
      setSelectedNodeIds([error.nodeId]);

      // Center viewport on node
      const node = nodes.find(n => n.id === error.nodeId);
      if (node && reactFlowInstance) {
        reactFlowInstance.setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 500 });
      }
    }
  }, [nodes, reactFlowInstance, setSelectedNodeIds]);

  // ✅ Listen for node selection events from error tooltip
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const nodeId = e.detail?.nodeId;
      if (nodeId) {
        setSelectedNodeIds([nodeId]);
        const node = nodes.find(n => n.id === nodeId);
        if (node && reactFlowInstance) {
          reactFlowInstance.setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 500 });
        }
      }
    };
    document.addEventListener('flowchart:selectNode', handler as EventListener);
    return () => document.removeEventListener('flowchart:selectNode', handler as EventListener);
  }, [nodes, reactFlowInstance, setSelectedNodeIds]);

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

  // Deferred apply for labels on just-created edges (avoids race with RF state)
  const { scheduleApplyLabel, pendingApplyRef } = useEdgeLabelScheduler({
    edgesRef,
    edges,
    setEdges,
    setSelectedEdgeId,
    pendingEdgeIdRef,
  });

  // Export scheduleApplyLabel, setEdges e setNodes per Intellisense (finalize link → hidden: false sul nodo temp)
  // Nota: usa `setNodes` (non setNodesWithLog) perché questo effect è sopra alla definizione di setNodesWithLog.
  useEffect(() => {
    FlowStateBridge.setScheduleApplyLabel(scheduleApplyLabel);
    FlowStateBridge.setSetEdges(setEdges);
    FlowStateBridge.setSetNodes(setNodes);
    return () => {
      FlowStateBridge.setScheduleApplyLabel(undefined);
      FlowStateBridge.setSetEdges(undefined);
      FlowStateBridge.setSetNodes(undefined);
    };
  }, [scheduleApplyLabel, setEdges, setNodes]);

  const onNodesChangeRef = useRef<(changes: any) => void>(() => {});

  // Log execution state changes (only when values change)
  const prevStateRef = useRef<{ currentNodeId?: string | null; executedCount?: number; isRunning?: boolean }>({});
  useEffect(() => {
    const execState = propExecutionState ?? FlowStateBridge.getExecutionState();
    const task = propCurrentTask ?? FlowStateBridge.getCurrentTask();
    const running = propIsRunning ?? FlowStateBridge.isRunning();

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

  // --- Undo/Redo command stack ---
  const { undo, redo } = useUndoRedoManager();
  // Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Y or Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

  // Centralized entity creation hook
  const entityCreation = useEntityCreation();
  const { createFactoryTask, createBackendCall, createMacrotask, createTask, createCondition } = entityCreation;

  // Adapter functions to match signatures expected by useFlowConnect
  const createFactoryTaskAdapter = useCallback(() => {
    createFactoryTask('');
  }, [createFactoryTask]);

  const createBackendCallAdapter = useCallback(() => {
    createBackendCall(''); // Solo name, scope opzionale
  }, [createBackendCall]);

  const createTaskAdapter = useCallback(() => {
    createMacrotask(''); // Solo name, scope opzionale
  }, [createMacrotask]);

  // ProjectData for condition creation
  const { data: projectData } = useProjectData();
  const structuralProjectId = useMemo(
    () =>
      resolveVariableStoreProjectId(
        String(
          (projectData as { id?: string; projectId?: string } | null)?.id ??
            (projectData as { projectId?: string } | null)?.projectId ??
            ''
        ).trim() || undefined
      ),
    [projectData]
  );

  /** Runs before {@link useCrossNodeSubflowPortalMove} (registration order → capture phase first). */
  useCrossFlowRowMoveOrchestrator({ projectId: structuralProjectId, projectData });
  useCrossNodeSubflowPortalMove({ flowId, nodes });

  const [elDropBanner, setElDropBanner] = useState<ElevenLabsFlowDropMessage | null>(null);
  const elDropBannerTimerRef = useRef<number>();
  const onElevenLabsDropMessage = useCallback((msg: ElevenLabsFlowDropMessage) => {
    setElDropBanner(msg);
    window.clearTimeout(elDropBannerTimerRef.current);
    elDropBannerTimerRef.current = window.setTimeout(() => setElDropBanner(null), 7000);
  }, []);
  const { elDropActive, onFlowDragOver, onFlowDragLeave, onFlowDrop } = useElevenLabsFlowDrop({
    nodes,
    setNodes,
    projectId: structuralProjectId,
    flowId: flowId ?? 'main',
    onDropMessage: onElevenLabsDropMessage,
  });

  const nodeActions = useNodeActions({
    nodes,
    deleteNode,
    addNodeAtPosition,
    updateNode,
    reactFlowInstance,
    projectId: structuralProjectId,
    flowCanvasId: flowId,
  });
  const { deleteNodeWithLog } = nodeActions;

  const { actions: intellisenseActions } = useIntellisense();

  const onAfterConnect = useCallback(
    (edgeId: string, connection: Connection) => {
      pendingEdgeIdRef.current = edgeId;
      const menuPos = connectionMenuRef.current?.position;
      const lastMouse = FlowStateBridge.getLastMousePosition();
      const fallback =
        menuPos && (menuPos.x !== 0 || menuPos.y !== 0)
          ? { x: menuPos.x, y: menuPos.y }
          : { x: lastMouse.x || window.innerWidth / 2, y: lastMouse.y || window.innerHeight / 2 };

      const runOpen = () => {
        const linkMidScreen = computeLinkMidScreenFromConnection(
          storeApi,
          reactFlowInstance,
          connection,
          fallback
        );
        intellisenseActions.openForEdge(edgeId, { linkMidScreen });
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(runOpen);
      });
    },
    [storeApi, reactFlowInstance, intellisenseActions, connectionMenuRef]
  );

  // Sostituisco onConnect (dopo deleteNodeWithLog)
  const { onConnect, onConnectStart } = useFlowConnect(
    reactFlowInstance,
    connectionMenuRef,
    setNodes,
    setEdges,
    nodesRef,
    closeMenu,
    deleteNodeWithLog,
    updateNode,
    createFactoryTaskAdapter,
    createBackendCallAdapter,
    createTaskAdapter,
    nodeIdCounterRef,
    onAfterConnect
  );

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
    createFactoryTask,
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

  // Normalize dashed edges only when needed (avoid unconditional full-array churn).
  useEffect(() => {
    setEdges((eds) =>
      {
        let changed = false;
        const next = eds.map(e => {
          if (e.style && e.style.strokeDasharray) {
            changed = true;
            return { ...e, style: { ...e.style, strokeDasharray: undefined } };
          }
          return e;
        });
        return changed ? next : eds;
      }
    );
  }, [setEdges]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const flowShellRef = useRef<HTMLDivElement>(null);
  const shellReady = useFlowCanvasShellReady(flowCanvasId, flowShellRef, canvasRef);
  const initialFitDoneRef = useRef(false);
  const flowRfId = omniaFlowReactFlowId(String(flowId ?? 'main').trim());
  const flowBgPatternId = omniaFlowBackgroundPatternId(String(flowId ?? 'main').trim());

  useEffect(() => {
    initialFitDoneRef.current = false;
  }, [flowId]);

  /** One-time fit when the flow first gets nodes (VIEWPORT_INITIAL_FIT — no repeat on upsert). */
  useEffect(() => {
    if (!reactFlowInstance || nodes.length === 0 || initialFitDoneRef.current) return;
    initialFitDoneRef.current = true;
    const id = requestAnimationFrame(() => {
      try {
        reactFlowInstance.fitView({ padding: 0.18, duration: 0 });
        const vp = reactFlowInstance.getViewport();
        if (Number.isFinite(vp.x) && Number.isFinite(vp.y) && Number.isFinite(vp.zoom)) {
          emitViewportInitialFit(flowCanvasId, { x: vp.x, y: vp.y, zoom: vp.zoom });
          emitViewportSettled(flowCanvasId, { x: vp.x, y: vp.y, zoom: vp.zoom });
        }
      } catch {
        /* noop */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [reactFlowInstance, nodes.length, flowCanvasId]);

  /** Keep graph in view when canvas shrinks (e.g. Response Editor opens). */
  useEffect(() => {
    return subscribeFlowCanvasSemantic((ev) => {
      if (String(ev.flowId).trim() !== flowCanvasId || ev.type !== 'CANVAS_LAYOUT_SETTLED') return;
      const apply = () => {
        try {
          const panned = keepFlowGraphInView(
            reactFlowInstance,
            nodes,
            ev.width,
            ev.height
          );
          if (panned) {
            const vp = reactFlowInstance.getViewport();
            if (Number.isFinite(vp.x) && Number.isFinite(vp.y) && Number.isFinite(vp.zoom)) {
              emitViewportSettled(flowCanvasId, { x: vp.x, y: vp.y, zoom: vp.zoom });
            }
          }
        } catch {
          /* RF not ready */
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(apply));
    });
  }, [flowCanvasId, reactFlowInstance, nodes]);

  // After dock split: instant horizontal pan only (split is lateral; keep Y + zoom — no vertical jump).
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ flowId?: string; nodeId?: string }>;
      const targetFlow = String(ce.detail?.flowId || '').trim();
      const nodeId = String(ce.detail?.nodeId || '').trim();
      const selfFlow = String(flowId ?? 'main').trim();
      if (!nodeId || !targetFlow || targetFlow !== selfFlow) return;

      const applyHorizontalPan = () => {
        try {
          const inst = reactFlowInstance;
          if (!inst) return;
          const n = inst.getNode(nodeId);
          if (!n) return;
          const w = Number((n as any).width ?? (n as any).measured?.width ?? 320) || 320;
          const h = Number((n as any).height ?? (n as any).measured?.height ?? 140) || 140;
          const cx = n.position.x + w / 2;
          const cy = n.position.y + h / 2;

          const paneEl = canvasRef.current?.querySelector('.react-flow__pane') as HTMLElement | null;
          if (!paneEl || paneEl.clientWidth <= 0) return;

          const screen = inst.flowToScreenPosition({ x: cx, y: cy });
          const vp = inst.getViewport();
          const deltaX = paneEl.clientWidth / 2 - screen.x;
          inst.setViewport({ x: vp.x + deltaX, y: vp.y, zoom: vp.zoom }, { duration: 0 });
        } catch {
          /* noop */
        }
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(applyHorizontalPan);
      });
      window.setTimeout(applyHorizontalPan, 90);
      window.setTimeout(applyHorizontalPan, 220);
    };

    document.addEventListener('flowchart:centerViewportOnNode', handler as EventListener);
    return () => document.removeEventListener('flowchart:centerViewportOnNode', handler as EventListener);
  }, [flowId, reactFlowInstance]);

  const { createNodeAt } = nodeActions;

  // ✅ Listener per creare un nodo dal canvas quando si rilascia una riga
  useEffect(() => {
    const handleCreateNodeFromRow = (event: CustomEvent) => {
      const detail = event.detail as {
        rowData?: unknown;
        cloneScreenPosition?: { x: number; y: number };
        flowCanvasId?: string;
        operationId?: string;
        dndTraceId?: string;
      };
      const { rowData, cloneScreenPosition, flowCanvasId: targetFlowId } = detail;

      if (!rowData || !cloneScreenPosition) {
        return;
      }

      const selfFlowId = String(flowId ?? 'main').trim();
      const target = String(targetFlowId ?? '').trim();
      if (target !== selfFlowId) {
        return;
      }

      const traceOp = String(detail.operationId || detail.dndTraceId || '').trim();

      // ✅ Crea il nodo posizionandolo esattamente dove è il clone (coordinate schermo convertite in flow)
      createNodeAt(
        cloneScreenPosition.x,
        cloneScreenPosition.y,
        rowData,
        traceOp ? { operationId: traceOp, dndTraceId: traceOp } : undefined
      );
    };

    window.addEventListener('createNodeFromRow', handleCreateNodeFromRow as EventListener);
    return () => {
      window.removeEventListener('createNodeFromRow', handleCreateNodeFromRow as EventListener);
    };
  }, [createNodeAt, flowId]);

  // ✅ REMOVED: onPaneClick - now in useFlowEventHandlers

  // Doppio click sul canvas: listener nativo in capture in useFlowEventHandlers (come GrammarCanvasView)

  // ✅ RIMUOVERE le funzioni locali:
  // - cleanupAllTempNodesAndEdges (righe 814-841)
  // - createTemporaryNode (righe 874-942)
  // e sostituire con:
  const { cleanupAllTempNodesAndEdges, createTemporaryNode } = useTemporaryNodes(
    setNodes,
    setEdges,
    reactFlowInstance,
    storeApi,
    connectionMenuRef,
    setNodesWithLog,
    isCreatingTempNode
  );

  // Export cleanup for Intellisense
  useEffect(() => {
    FlowStateBridge.setCleanupAllTempNodesAndEdges(cleanupAllTempNodesAndEdges);
    return () => FlowStateBridge.setCleanupAllTempNodesAndEdges(undefined);
  }, [cleanupAllTempNodesAndEdges]);

  useEffect(() => {
    FlowStateBridge.setPendingEdgeConnectClearHandler(() => {
      pendingEdgeIdRef.current = null;
    });
    return () => FlowStateBridge.setPendingEdgeConnectClearHandler(undefined);
  }, []);

  // Promuove il nodo/edge temporanei a definitivi e rimuove ogni altro temporaneo residuo
  // ✅ RIMOSSA: function finalizeTempPromotion - non utilizzata

  const withNodeLock = useNodeCreationLock();

  const onConnectEnd = useCallback((event: any) => {
    // Reset connection flag on release
    if (FlowStateBridge.isConnecting()) {
      FlowStateBridge.setIsConnecting(false);
    }

    // Safety check: if drag started from handle, cleanup
    if (FlowStateBridge.isDragStartedFromHandle()) {
      FlowStateBridge.setDragStartedFromHandle(false);
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
          const { tempEdgeId, tempNodeId, sourceNodeId, sourceHandleId, verticalColumnDrop, horizontalRowDrop } = result;

          diagFlowLink('onConnectEnd:afterCreateTemp', {
            tempEdgeId,
            tempNodeId,
            sourceNodeId,
            sourceHandleId,
            clientX: event.clientX,
            clientY: event.clientY,
          });

          if (!intellisenseActions?.openForEdge) {
            diagFlowLink('onConnectEnd:skip', { reason: 'no_openForEdge' });
            return;
          }

          try {
            await waitForHandleBounds(storeApi, tempNodeId);
          } catch (e) {
            logError('FLOW_EDITOR', 'waitForHandleBounds(temp node)', e);
            diagFlowLink('openForEdge:fallback', {
              reason: 'waitForHandleBounds_timeout_or_error',
              tempEdgeId,
              tempNodeId,
              linkMidScreen: { x: event.clientX, y: event.clientY },
            });
            intellisenseActions.openForEdge(tempEdgeId, {
              linkMidScreen: { x: event.clientX, y: event.clientY },
            });
            return;
          }

          const anchorResult = computeLinkMidScreenForTempEdgeUnified({
            storeApi,
            reactFlowInstance,
            sourceNodeId,
            tempNodeId,
            sourceHandleId,
          });

          if (anchorResult) {
            const { centers, anchorFlow, linkMidScreen } = anchorResult;
            diagFlowLink('openForEdge:anchor', {
              sx: centers.sx,
              sy: centers.sy,
              tx: centers.tx,
              ty: centers.ty,
              deltaFlowX: Math.abs(centers.tx - centers.sx),
              verticalColumnDrop,
              horizontalRowDrop,
              vhvCollinearEps: VHV_COLLINEAR_EPS_PX,
              anchorFlow,
              linkMidScreen,
            });
            intellisenseActions.openForEdge(tempEdgeId, { linkMidScreen });
          } else {
            logError('FLOW_EDITOR', 'openForEdge: missing handle bounds after wait', {
              sourceNodeId,
              tempNodeId,
            });
            diagFlowLink('openForEdge:fallback', {
              reason: 'missing_handles_after_wait',
              tempEdgeId,
              linkMidScreen: { x: event.clientX, y: event.clientY },
            });
            intellisenseActions.openForEdge(tempEdgeId, {
              linkMidScreen: { x: event.clientX, y: event.clientY },
            });
          }
        } catch (error) {
          logError('FLOW_EDITOR', 'onConnectEnd temp node / intellisense', error);
          diagFlowLink('onConnectEnd:error', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    } else {
      // Solo se NON stiamo creando un nodo, pulisci i temporanei
      cleanupAllTempNodesAndEdges();
    }
  }, [withNodeLock, createTemporaryNode, openMenu, cleanupAllTempNodesAndEdges, pendingEdgeIdRef, intellisenseActions, storeApi, reactFlowInstance]);

  // Event handlers moved to useFlowEventHandlers hook

  // ✅ Use Flow Viewport hook for zoom, pan, and scroll-to-node
  const { handleWheel } = useFlowViewport(reactFlowInstance, canvasRef);

  // ✅ Use Cursor Tooltip hook
  const { setCursorTooltip } = useCursorTooltip(nodes.length);

  // Persisted selection rectangle (keeps the user-drawn area after mouseup)
  const [persistedSel, setPersistedSel] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const dragStartRef = useRef<null | { x: number; y: number }>(null);

  // ✅ Use Flow Event Handlers hook
  const eventHandlers = useFlowEventHandlers(
    reactFlowInstance,
    flowCanvasId,
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

  const subflowContextValue = useMemo(() => ({ onOpenSubflowForTask }), [onOpenSubflowForTask]);
  const edgesWithSelection = useMemo(
    () => edges.map((e) => ({ ...e, selected: e.id === selectedEdgeId })),
    [edges, selectedEdgeId]
  );
  const { displayNodes, onNodesChange: onNodesChangeSemantic } = useFlowCanvasSemanticBridge({
    flowId: flowCanvasId,
    nodes,
    setNodes,
    setSelectedNodeIds,
    updateNodeInternals,
  });

  onNodesChangeRef.current = onNodesChangeSemantic;

  useEffect(() => {
    FlowStateBridge.setApplyNodeChanges((changes) => onNodesChangeRef.current(changes));
    return () => FlowStateBridge.setApplyNodeChanges(undefined);
  }, []);

  return (
    <FlowSubflowProvider value={subflowContextValue}>
      <FlowCanvasProvider flowId={flowId ?? 'main'}>
      <div
        className={
          'relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden' +
          (elDropActive ? ' ring-2 ring-inset ring-violet-400/70' : '')
        }
        ref={canvasRef}
        data-omnia-flowchart-canvas-root={String(flowId ?? 'main').trim()}
        data-flow-canvas-id={String(flowId ?? 'main').trim()}
        onMouseLeave={() => setCursorTooltip(null)}
        onMouseDown={eventHandlers.onMouseDown}
        onDragOver={onFlowDragOver}
        onDragLeave={onFlowDragLeave}
        onDrop={onFlowDrop}
      >
      {elDropBanner ? (
        <div
          className={
            'pointer-events-none absolute left-1/2 top-3 z-20 max-w-md -translate-x-1/2 rounded-md px-4 py-2 text-center text-xs font-medium shadow-lg ' +
            (elDropBanner.kind === 'created'
              ? 'border border-emerald-600/60 bg-emerald-950 text-emerald-100'
              : 'border border-amber-600/60 bg-amber-950 text-amber-100')
          }
        >
          {elDropBanner.label}: {elDropBanner.detail}
        </div>
      ) : null}
      <ExecutionStateProvider
        executionState={propExecutionState ?? FlowStateBridge.getExecutionState()}
        currentTask={propCurrentTask ?? FlowStateBridge.getCurrentTask()}
        isRunning={propIsRunning ?? FlowStateBridge.isRunning()}
      >
        <FlowchartWrapper
          ref={flowShellRef}
          className="flex min-h-0 w-full flex-1 flex-col"
          overlay={
            persistedSel ? (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: persistedSel.x,
                  top: persistedSel.y,
                  width: persistedSel.w,
                  height: persistedSel.h,
                  backgroundColor: 'rgba(125, 211, 252, 0.18)',
                  border: '1px solid rgba(56, 189, 248, 0.9)',
                  boxShadow: '0 0 0 1px rgba(56,189,248,0.25) inset',
                  zIndex: 5,
                }}
              />
            ) : null
          }
        >
          {shellReady ? (
            <ReactFlow
              id={flowRfId}
              nodes={displayNodes}
              edges={edgesWithSelection}
              onNodesChange={onNodesChangeSemantic}
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
              selectNodesOnDrag={false}
              onNodeDragStart={eventHandlers.onNodeDragStart}
              onNodeDrag={eventHandlers.onNodeDrag}
              onNodeDragStop={eventHandlers.onNodeDragStop}
              onNodeDoubleClick={eventHandlers.onNodeDoubleClick}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              minZoom={0.15}
              maxZoom={4}
              className="bg-white"
              style={{ width: '100%', height: '100%', backgroundColor: '#ffffff' }}
              selectionOnDrag={true}
              onSelectionChange={eventHandlers.onSelectionChange}
              panOnDrag={[2]}
              zoomOnScroll={false}
              zoomOnPinch={false}
              panOnScroll={false}
              onWheel={handleWheel}
              zoomOnDoubleClick={false}
              onMouseUp={eventHandlers.onMouseUp}
              onMoveEnd={() => {
                try {
                  const vp = reactFlowInstance.getViewport();
                  if (Number.isFinite(vp.x) && Number.isFinite(vp.y) && Number.isFinite(vp.zoom)) {
                    emitViewportSettled(flowCanvasId, { x: vp.x, y: vp.y, zoom: vp.zoom });
                  }
                } catch {
                  /* noop */
                }
              }}
            >
              <ReactFlowContainerResize
                flowCanvasId={flowCanvasId}
                containerRef={flowShellRef}
                fallbackRef={canvasRef}
              />
              <Controls className="bg-white shadow-lg border border-slate-200" />
              <Background
                id={flowBgPatternId}
                variant={BackgroundVariant.Dots}
                gap={22}
                size={1.5}
                color="#eef2f7"
              />
              <FlowPanZoomOverview
                flowCanvasId={flowCanvasId}
                nodes={nodes}
                viewportHostRef={canvasRef}
                theme="light"
                reactFlowInstanceId={flowRfId}
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
          ) : (
            <div
              className="h-full w-full min-h-0 min-w-0 flex-1 bg-white"
              aria-hidden
              data-omnia-flow-shell-pending={flowCanvasId}
            />
          )}
        </FlowchartWrapper>
      </ExecutionStateProvider>

      {/* Selection context mini menu at bottom-right of selection */}
      {selectionMenu.show && selectedNodeIds.length >= 2 && (
        <SelectionMenu
          selectedNodeIds={selectedNodeIds}
          selectionMenu={selectionMenu}
          nodes={nodes}
          canvasHostRef={canvasRef}
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
          className="pointer-events-none absolute left-2 top-2 text-[10px]"
        >

        </div>
      )}

      {/* ✅ ERRORS: Always visible on nodes/edges with colored borders - no sidebar needed */}

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
      </div>
      </FlowCanvasProvider>
    </FlowSubflowProvider>
  );
};

export const FlowEditor: React.FC<FlowEditorProps> = (props) => {
  useEffect(() => {
    incrementEditorOpenMetric('flowEditor.mount');
  }, []);

  const { data: projectData } = useProjectData();
  const intellisenseProviders = useMemo(
    () => ({
      getProjectData: () => projectData,
      getFlowNodes: () => props.nodes ?? [],
      getFlowEdges: () => props.edges ?? [],
    }),
    [projectData, props.nodes, props.edges]
  );

  /**
   * Provider order is fixed: NodeRegistry → ReactFlow → Intellisense → canvas + popover.
   * Intellisense must be inside ReactFlowProvider so consumers always have both contexts.
   */
  return (
    <NodeRegistryProvider>
      <ReactFlowProvider>
        <IntellisenseProvider providers={intellisenseProviders}>
          <FlowEditorContent {...props} />
          <IntellisensePopover />
        </IntellisenseProvider>
      </ReactFlowProvider>
    </NodeRegistryProvider>
  );
};
