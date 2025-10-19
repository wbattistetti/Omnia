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
import { CustomNode } from './CustomNode';
import { TaskNode } from './TaskNode';
import { v4 as uuidv4 } from 'uuid';
import { CustomEdge } from './CustomEdge';
import { useEdgeManager } from '../../hooks/useEdgeManager';
import { useConnectionMenu } from '../../hooks/useConnectionMenu';
import { useNodeManager } from '../../hooks/useNodeManager';
import { useProjectDataUpdate, useProjectData } from '../../context/ProjectDataContext';
import { ProjectDataService } from '../../services/ProjectDataService';
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
import { SelectionMenu } from './components/SelectionMenu';
import { EdgeConditionMenu } from './components/EdgeConditionMenu';

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
  onOpenTaskFlow?: (flowId: string, title: string) => void;
}

const FlowEditorContent: React.FC<FlowEditorProps> = ({
  flowId,
  onPlayNode,
  nodes,
  setNodes,
  edges,
  setEdges,
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

  // Commit helper: apply a label to the current linkage context deterministically
  const commitEdgeLabel = useCallback((label: string): boolean => {
    // 1) Just-created edge between existing nodes
    if (pendingEdgeIdRef.current) {
      const pid = pendingEdgeIdRef.current;
      // If not yet present in state, defer until it appears
      const exists = (edgesRef.current || []).some(e => e.id === pid);
      if (exists) {
        setEdges(eds => eds.map(e => e.id === pid ? { ...e, label } : e));
        setSelectedEdgeId(pid);
        pendingEdgeIdRef.current = null;
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
      console.log('[🔍 STABILIZE.1] Starting stabilization (first occurrence)', { 
        tempNodeId, 
        tempEdgeId,
        flowPosition: fp,
        timestamp: Date.now()
      });
      setNodes(nds => {
        const stabilizedNodes = nds.map(n => {
          if (n.id === tempNodeId) {
            console.log('[🔍 STABILIZE.1] Stabilizing temporary node', { 
              tempNodeId, 
              pos: n.position, 
              fp, 
              timestamp: Date.now() 
            });
            return { ...n, isTemporary: false };
          }
          return n;
        });
        return stabilizedNodes;
      });
      setEdges(eds => eds.map(e => e.id === tempEdgeId ? { ...e, label } : e));
      setSelectedEdgeId(tempEdgeId);
      closeMenu();
      return true;
    }
    return false;
  }, [setEdges, setSelectedEdgeId, scheduleApplyLabel, setNodes, connectionMenuRef, closeMenu]);

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
        try { console.log('[CanvasDbg][doc.capture]', { key: e.key, target: (e.target as HTMLElement)?.className, defaultPrevented: e.defaultPrevented }); } catch {}
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
  const { createAgentAct, createBackendCall, createTask, createCondition } = entityCreation;

  // Adapter functions per matchare le signature expected da useFlowConnect
  const createAgentActAdapter = useCallback(() => {
    createAgentAct(''); // Solo name, scope opzionale
  }, [createAgentAct]);

  const createBackendCallAdapter = useCallback(() => {
    createBackendCall(''); // Solo name, scope opzionale
  }, [createBackendCall]);

  const createTaskAdapter = useCallback(() => {
    createTask(''); // Solo name, scope opzionale
  }, [createTask]);

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

  // Log dettagliato su ogni cambiamento di nodes.length
  useEffect(() => {
    console.log("📊 [NODES_CHANGE] Nodes array changed", { 
      count: nodes.length,
      nodeIds: nodes.map(n => n.id),
      tempNodes: nodes.filter(n => n.data?.isTemporary).map(n => n.id),
      timestamp: Date.now()
    });
    
    if (reactFlowInstance) {
      // Rimuovi completamente codice non utilizzato
    }
  }, [nodes.length, reactFlowInstance]);

  // Aggiungi gli hook per ProjectData (per la creazione di condizioni)
  const { addItem, addCategory } = useProjectDataUpdate();
  const { data: projectData } = useProjectData();

  // Prepara seed items leggendo SOLO dal nodo sorgente: ProblemClassification → problem.intents (con fallback shadow locale)
  const problemIntentSeedItems = React.useMemo(() => {
    try {
      if (!connectionMenu.show) return undefined;
      const sourceId = connectionMenu.sourceNodeId as string | null;
      if (!sourceId) return undefined;
      const srcNode = nodes.find(n => n.id === sourceId);
      const rows: any[] = Array.isArray((srcNode?.data as any)?.rows) ? (srcNode!.data as any).rows : [];
      if (!rows.length) return undefined;

      // 1) riga ProblemClassification (max una)
      const problemRow = rows.find(r => r.text && r.text.toLowerCase().includes('problemclassification'));
      if (!problemRow) return undefined;

      // 2) Leggi problem.intents (se presente) o usa shadow locale
      const problemIntents = (problemRow as any)?.problem?.intents;
      if (Array.isArray(problemIntents) && problemIntents.length) {
        return problemIntents.map((intent: any) => ({
          label: intent.label || intent.name || 'Unknown',
          value: intent.id || intent.name || 'unknown',
          description: intent.description || ''
        }));
      }

      // Fallback: shadow locale (se non c'è problem.intents)
      return [
        { label: 'Customer Service', value: 'customer_service', description: 'Assistenza clienti e supporto' },
        { label: 'Technical Support', value: 'technical_support', description: 'Supporto tecnico e risoluzione problemi' },
        { label: 'Sales Inquiry', value: 'sales_inquiry', description: 'Informazioni commerciali e vendite' },
        { label: 'Billing Issue', value: 'billing_issue', description: 'Problemi di fatturazione e pagamenti' },
        { label: 'Product Information', value: 'product_information', description: 'Informazioni su prodotti e servizi' }
      ];
    } catch (error) {
      return undefined;
    }
  }, [connectionMenu.show, connectionMenu.sourceNodeId, nodes]);

  // Gestione creazione nuova condizione
  const handleCreateCondition = useCallback(async (name: string, scope?: 'global' | 'industry') => {
    try {
      try { console.log('[CondFlow] service.enter', { name, scope }); } catch {}
      // Se stiamo etichettando un edge appena creato tra due nodi esistenti,
      // aggiorna subito quell'edge per non perdere la selezione dell'utente.
      let attachToEdgeId: string | null = null;
      if (pendingEdgeIdRef.current) {
        attachToEdgeId = pendingEdgeIdRef.current;
        setEdges((eds) => eds.map(e => e.id === attachToEdgeId ? { ...e, label: name } : e));
        setSelectedEdgeId(attachToEdgeId);
        pendingEdgeIdRef.current = null;
        // non chiudere qui: continuiamo a creare la condition e poi attacchiamo l'id
      }
      let categoryId = '';
      const conditions = (projectData as any)?.conditions || [];

      if (conditions.length > 0) {
        categoryId = conditions[0].id;
      } else {
        await addCategory('conditions', 'Default Conditions');
        const updatedData = await ProjectDataService.loadProjectData();
        const updatedConditions = (updatedData as any)?.conditions || [];
        categoryId = updatedConditions[0]?.id || '';
      }

      if (categoryId) {
        // Apri il pannello conditions nel sidebar
        try { (await import('../../ui/events')).emitSidebarOpenAccordion('conditions'); } catch {}

        // Aggiungi la nuova condizione
        await addItem('conditions', categoryId, name, '', scope);
        try { console.log('[CondFlow] service.created', { categoryId, name }); } catch {}

        // Ricarica dati per ottenere l'ID della nuova condizione
        const refreshed = await ProjectDataService.loadProjectData();
        const refCat = (refreshed as any)?.conditions?.find((c:any)=>c.id===categoryId);
        const created = refCat?.items?.find((i:any)=>i.name===name);
        const conditionId = created?._id || created?.id;

        // Evidenzia nel sidebar e aggiorna UI (non blocca il flusso)
        setTimeout(async () => { try { (await import('../../ui/events')).emitSidebarHighlightItem('conditions', name); } catch {} }, 100);
        try { (await import('../../ui/events')).emitSidebarForceRender(); } catch {}

        // Se avevamo un edge esistente, attacca ora il conditionId e chiudi
        if (attachToEdgeId) {
          setEdges((eds) => eds.map(e => e.id === attachToEdgeId ? { ...e, data: { ...(e.data || {}), onDeleteEdge, conditionId }, label: name } : e));
          closeMenu();
          return;
        }

        // Crea/promuovi nodo collegato
        const getTargetHandle = (sourceHandleId: string): string => {
          switch (sourceHandleId) {
            case 'bottom': return 'top-target';
            case 'top': return 'bottom-target';
            case 'left': return 'right-target';
            case 'right': return 'left-target';
            default: return 'top-target';
          }
        };

        // Stabilizza il nodo temporaneo esistente se presente, altrimenti crea nuovo nodo
        let tempNodeId = connectionMenuRef.current.tempNodeId as string | null;
        let tempEdgeId = connectionMenuRef.current.tempEdgeId as string | null;
        if (!tempNodeId || !tempEdgeId) {
          try {
            const sourceId = connectionMenuRef.current.sourceNodeId || '';
            const maybeTemp = nodesRef.current.find(n => (n as any)?.data?.isTemporary === true);
            if (maybeTemp) {
              const linking = edges.find(e => e.target === maybeTemp.id && e.source === sourceId);
              if (linking) { tempNodeId = maybeTemp.id; tempEdgeId = linking.id; }
            }
          } catch {}
        }
        if (tempNodeId && tempEdgeId) {
          try { console.log('[CondFix] convertTemp', { tempNodeId, tempEdgeId }); } catch {}
          console.log('[CondFix] SHOW FINAL NODE', {
            tempNodeId,
            finalPosition: nodesRef.current.find(n => n.id === tempNodeId)?.position,
            nodeData: nodesRef.current.find(n => n.id === tempNodeId)?.data
          });
          
          console.log('[🔍 STABILIZE_NODE] Stabilizing temporary node', {
            tempNodeId,
            tempEdgeId,
            conditionName: name,
            timestamp: Date.now()
          });
          
          // ✅ FIX: Marca il nodo come stabilizzato per evitare riposizionamento
          tempFlags.stabilizedTempNodes.current.add(tempNodeId);
          
          // ✅ FIX: Rimuovi il flag di creazione in corso
          tempFlags.creatingTempNodes.current.delete(tempNodeId);
          
          setNodesWithLog((nds: Node<NodeData>[]) => {
            const updatedNodes = nds.map((n: Node<NodeData>) => {
              if (n.id === tempNodeId) {
                const oldPosition = n.position;
                const updatedNode = {
                  ...n,
                  data: { ...(n.data as any), isTemporary: false, hidden: false, focusRowId: '1' }
                };
                console.log('[🔍 STABILIZE_NODE] Node stabilized', {
                  nodeId: tempNodeId,
                  oldPosition,
                  newPosition: updatedNode.position,
                  positionChanged: oldPosition.x !== updatedNode.position.x || oldPosition.y !== updatedNode.position.y,
                  isTemporaryChanged: n.data?.isTemporary !== updatedNode.data?.isTemporary,
                  markedAsStabilized: true
                });
                return updatedNode;
              }
              return n;
            });
            return updatedNodes;
          });
          setEdges((eds) => eds.map(e => e.id === tempEdgeId ? {
            ...e,
            style: { stroke: '#8b5cf6' },
            label: name,
            data: { ...(e.data || {}), onDeleteEdge, conditionId }
          } : e));
          // azzera i ref temporanei per evitare doppie creazioni successive
          connectionMenuRef.current.tempNodeId = null as any;
          connectionMenuRef.current.tempEdgeId = null as any;
        } else {
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
              title: '',
              rows: [],
              onDelete: () => deleteNodeWithLog(newNodeId),
              onUpdate: (updates: any) => updateNode(newNodeId, updates),
              onCreateAgentAct: createAgentAct,
              onCreateBackendCall: createBackendCall,
              onCreateTask: createTask,
              onCreateCondition: createCondition,
              focusRowId: '1'
            },
          };
          const targetHandle = getTargetHandle(connectionMenuRef.current.sourceHandleId || '');
          const newEdge: Edge<EdgeData> = {
            id: newEdgeId,
            source: connectionMenuRef.current.sourceNodeId || '',
            sourceHandle: connectionMenuRef.current.sourceHandleId || undefined,
            target: newNodeId,
            targetHandle: targetHandle,
            style: { stroke: '#8b5cf6' },
            label: name,
            type: 'custom',
            data: { onDeleteEdge },
            markerEnd: 'arrowhead',
          };
          setNodes((nds) => nds);
          setNodes((nds) => {
            const filtered = connectionMenuRef.current.tempNodeId ? nds.filter(n => n.id !== connectionMenuRef.current.tempNodeId) : nds;
            return [...filtered, newNode];
          });
          setEdges((eds) => {
            const filtered = removeAllTempEdges(eds, nodesRef.current);
            return [...filtered, newEdge];
          });
          setNodeIdCounter(prev => prev + 1);
          try { console.log('[CondFix] createNew', { newNodeId, newEdgeId }); } catch {}
        }

        // Chiudi il menu dopo aver stabilizzato nodi/edge
        setTimeout(() => closeMenu(), 0);
      }
    } catch (error) {
      try { console.error('[CondFlow] error', error); } catch {}
    }
  }, [projectData, addItem, addCategory, closeMenu, nodeIdCounter, reactFlowInstance, connectionMenuRef, deleteNodeWithLog, updateNode, onDeleteEdge, setNodes, setEdges, nodesRef, setNodeIdCounter, createAgentAct, createBackendCall, createTask]);

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

  const createNodeAt = useCallback((clientX: number, clientY: number) => {
    // debug removed
    const newNodeId = nodeIdCounter.toString();
    let x = 0, y = 0;
    if (reactFlowInstance) {
      const pos = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
      x = pos.x - NODE_WIDTH / 2;
      y = pos.y - NODE_HEIGHT / 2;
    }
    const node: Node<NodeData> = {
      id: newNodeId,
      type: 'custom',
      position: { x, y },
      data: {
        title: '',
        rows: [],
        onDelete: () => deleteNodeWithLog(newNodeId),
        onUpdate: (updates: any) => updateNode(newNodeId, updates),
        hidden: true,
        focusRowId: '1',
        isTemporary: true,
      },
    };
    // debug removed
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
    
    // Disabilitata la cancellazione automatica dei nodi al click canvas (gestita da CustomNode)
    // nodes.forEach(() => {});
    
    try {
      const ev = new CustomEvent('flow:canvas:click', { bubbles: true });
      window.dispatchEvent(ev);
    } catch {}
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

  // Promuove il nodo/edge temporanei a definitivi e rimuove ogni altro temporaneo residuo
  function finalizeTempPromotion(keepNodeId: string, keepEdgeId?: string) {
    // rispetto lock: funzione chiamata in fase di conferma
    // 1) marca il nodo da tenere come non temporaneo e rimuovi tutti i temporanei residui
    setNodes((nds) => nds
      .map(n => n.id === keepNodeId ? { ...n, data: { ...(n.data as any), isTemporary: false, hidden: false, batchId: undefined } } : n)
      .filter(n => !(n as any)?.data?.isTemporary)
    );
    // 2) rimuovi eventuali edge che puntano a nodi temporanei (che sono appena stati rimossi)
    setEdges((eds) => {
      const current = nodesRef.current;
      return eds.filter(e => {
        const tgt = current.find(n => n.id === e.target);
        return !(tgt && (tgt.data as any)?.isTemporary);
      });
    });
    // 3) azzera i riferimenti temporanei e bersagli
    try {
      connectionMenuRef.current.tempNodeId = null as any;
      connectionMenuRef.current.tempEdgeId = null as any;
      connectionMenuRef.current.targetNodeId = null as any;
      connectionMenuRef.current.targetHandleId = null as any;
      (window as any).__flowLastTemp = null;
      tempFlags.tempEdgeIdGlobal.current = null;
    } catch {}
    // 4) cleanup di sicurezza
    cleanupAllTempNodesAndEdges();
  }

  const withNodeLock = useNodeCreationLock();

  // ✅ FIX: Funzione separata per aprire intellisense
  const openIntellisense = useCallback((tempNodeId: string, tempEdgeId: string, event: any) => {
    console.log("🎯 [INTELLISENSE] Starting node editing", { 
      tempNodeId, 
      tempEdgeId, 
      mousePos: { x: event.clientX, y: event.clientY },
      timestamp: Date.now()
    });
    
    // Apri il menu di connessione per mostrare l'intellisense
    console.log("🔍 [INTELLISENSE] Opening menu with:", {
      position: { x: event.clientX, y: event.clientY },
      sourceNodeId: connectionMenuRef.current.sourceNodeId,
      sourceHandleId: connectionMenuRef.current.sourceHandleId,
      currentMenuState: connectionMenuRef.current
    });
    
    openMenu(
      { x: event.clientX, y: event.clientY },
      connectionMenuRef.current.sourceNodeId,
      connectionMenuRef.current.sourceHandleId
    );
    
    console.log("🔍 [INTELLISENSE] Menu state after openMenu:", connectionMenuRef.current);
    
    // Registra i temp
    setTemp(tempNodeId, tempEdgeId);
    
    try {
      (connectionMenuRef.current as any).tempNodeId = tempNodeId;
      (connectionMenuRef.current as any).tempEdgeId = tempEdgeId;
      (connectionMenuRef.current as any).flowPosition = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      (window as any).__flowLastTemp = { nodeId: tempNodeId, edgeId: tempEdgeId };
      console.log("💾 [INTELLISENSE] Saved temporary references");
    } catch (error) {
      console.error("❌ [INTELLISENSE] Error saving temporary references:", error);
    }
    
    // Attiva l'editing del titolo sul nodo temporaneo dopo un tick
    setTimeout(() => {
      const tempNode = nodesRef.current.find(n => n.id === tempNodeId);
      if (tempNode && tempNode.data) {
        console.log("✅ [INTELLISENSE] Triggering title edit on temp node", { tempNodeId });
        // Trigger startEditingTitle se disponibile
        if (typeof tempNode.data.startEditingTitle === 'function') {
          tempNode.data.startEditingTitle();
        }
      } else {
        console.warn("⚠️ [INTELLISENSE] Temp node not found for editing", { tempNodeId });
      }
    }, 100);
    
    console.log("✅ [INTELLISENSE] Node editing setup completed", { 
      tempNodeId, 
      tempEdgeId,
      timestamp: Date.now()
    });
  }, [setTemp, openMenu, connectionMenuRef, reactFlowInstance, nodesRef]);

  const onConnectEnd = useCallback((event: any) => {
    console.log("🎬 [ON_CONNECT_END] Event triggered", { 
      target: event.target?.className,
      hasPendingEdge: !!pendingEdgeIdRef.current,
      hasSourceNode: !!connectionMenuRef.current.sourceNodeId,
      timestamp: Date.now()
    });
    
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
          openIntellisense(tempNodeId, tempEdgeId, event);
        } catch (error) {
          console.error("❌ [ON_CONNECT_END] Error creating temporary node:", error);
        }
      });
    } else {
      // Solo se NON stiamo creando un nodo, pulisci i temporanei
      console.log("❌ [ON_CONNECT_END] Not creating node - conditions not met, cleaning up");
      cleanupAllTempNodesAndEdges();
    }
  }, [withNodeLock, createTemporaryNode, openIntellisense, connectionMenuRef, cleanupAllTempNodesAndEdges, pendingEdgeIdRef]);

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
    // Attiva un lock per evitare cleanup concorrenti durante la conferma
    try { (connectionMenuRef.current as any).locked = true; } catch {}
    const label = item?.description || item?.name || '';

    // Commit via unified helper
    const handled = commitEdgeLabel(label);
    if (handled) { closeMenu(); try { (connectionMenuRef.current as any).locked = false; } catch {} return; }

    // A) Promuovi temp se presente
    const tempNodeId = connectionMenuRef.current.tempNodeId as string | null;
    const tempEdgeId = connectionMenuRef.current.tempEdgeId as string | null;
    if (tempNodeId && tempEdgeId) {
      // Assicura che la posizione usata sia quella del drop salvata in flowPosition
      const fp = (connectionMenuRef.current as any).flowPosition;
      console.log('[🔍 STABILIZE.2] Starting stabilization (second occurrence)', { 
        tempNodeId, 
        tempEdgeId,
        flowPosition: fp,
        timestamp: Date.now()
      });
      setNodes(nds => {
        const stabilizedNodes = nds.map(n => {
          if (n.id === tempNodeId) {
            console.log('[🔍 STABILIZE.2] Stabilizing temporary node', { 
              tempNodeId, 
              oldPosition: n.position,
              oldIsTemporary: (n.data as any)?.isTemporary,
              oldHidden: (n.data as any)?.hidden,
              timestamp: Date.now()
            });
            return {
              ...n,
              position: n.position, // Mantieni la posizione corretta del nodo temporaneo
              data: { ...(n.data as any), isTemporary: false, hidden: false, batchId: undefined }
            };
          }
          return n;
        });
        console.log('[🔍 STABILIZE.2] Node stabilization complete', { 
          tempNodeId, 
          totalNodes: stabilizedNodes.length,
          timestamp: Date.now()
        });
        return stabilizedNodes;
      });
      setEdges(eds => eds.map(e => e.id === tempEdgeId ? { ...e, label, style: { ...(e.style || {}), stroke: '#8b5cf6' } } : e));
      finalizeTempPromotion(tempNodeId, tempEdgeId);
      // azzera i riferimenti temp per evitare ulteriori cleanup
      connectionMenuRef.current.tempNodeId = null as any;
      connectionMenuRef.current.tempEdgeId = null as any;
      closeMenu();
      try { (connectionMenuRef.current as any).locked = false; } catch {}
      return;
    }

    // B) Collega due nodi esistenti o aggiorna edge (fallback)
    const src = connectionMenuRef.current.sourceNodeId;
    const tgt = connectionMenuRef.current.targetNodeId;
    if (src && tgt) {
      setEdges(eds => {
        const id = uuidv4();
        // Se esiste già una edge tra src e tgt, aggiorna label; altrimenti crea nuova
        const exists = eds.some(e => e.source === src && e.target === tgt);
        if (exists) {
          return eds.map(e => (e.source === src && e.target === tgt) ? { ...e, label } : e);
        }
        return [...eds, {
          id,
          source: src,
          sourceHandle: connectionMenuRef.current.sourceHandleId || undefined,
          target: tgt,
          targetHandle: connectionMenuRef.current.targetHandleId || undefined,
          style: { stroke: '#8b5cf6' },
          label,
          type: 'custom',
          data: { onDeleteEdge },
          markerEnd: 'arrowhead'
        }];
      });
      closeMenu();
      try { (connectionMenuRef.current as any).locked = false; } catch {}
      return;
    }

    // C) Altrimenti abort pulito (niente creazione nuovi nodi qui)
    // Non fare cleanup aggressivo qui: lascia stato invariato, solo chiudi menu
    closeMenu();
    try { (connectionMenuRef.current as any).locked = false; } catch {}
  }, [nodes, setNodes, setEdges, closeMenu]);

  // Handler robusto per chiusura intellisense/condition menu
  const handleConnectionMenuClose = useCallback(() => {
    // Se è in corso una conferma, non fare cleanup
    try { if ((connectionMenuRef.current as any)?.locked) { closeMenu(); return; } } catch {}
    // Rimuovi nodo e collegamento temporanei se esistono
    cleanupAllTempNodesAndEdges();
    closeMenu();
  }, [closeMenu]);

  const onNodeDragStart = useCallback((event: any, node: Node) => {
    // Controlla se l'evento è iniziato da un elemento con classe 'nodrag'
    const target = event.target as Element;
    const isAnchor = target && (target.classList.contains('rigid-anchor') || target.closest('.rigid-anchor'));

    console.log('[FlowEditor] NODE DRAG START ATTEMPT:', {
      nodeId: node.id,
      nodeType: node.type,
      targetTag: target?.tagName,
      targetClass: target?.className,
      hasNodrag: target?.classList.contains('nodrag'),
      closestNodrag: target?.closest('.nodrag'),
      isAnchor,
      eventType: event.type
    });

    if (target && (target.classList.contains('nodrag') || target.closest('.nodrag'))) {
      console.log('[FlowEditor] DRAG BLOCKED - nodrag element found');
      event.preventDefault();
      return false;
    }

    console.log('[FlowEditor] DRAG ALLOWED - proceeding with node drag');
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

  // Inizializza la viewport a zoom 1 solo al primissimo mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (reactFlowInstance && !initializedRef.current) {
      try { (reactFlowInstance as any).setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 }); } catch {}
      initializedRef.current = true;
    }
  }, [reactFlowInstance]);

  // Stabilizza nodeTypes/edgeTypes per evitare il warning RF#002 (HMR)
  // Spostati fuori dal componente per evitare ricreazioni durante HMR

  const tempFlags = useTempEdgeFlags();

  return (
    <div
      className="flex-1 h-full relative"
      ref={canvasRef}
      style={{ overflow: 'auto' }}
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
      {(() => { try { (window as any).__flowNodes = nodes; (window as any).__flowEdges = edges; if (flowId) { (window as any).__flows = (window as any).__flows || {}; (window as any).__flows[flowId] = { nodes, edges }; } } catch {} return null; })()}
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={onPaneClick}
        onMouseMove={handlePaneMouseMove}
        onEdgeClick={handleEdgeClick}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
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
        style={{ backgroundColor: '#ffffff', width: contentSize.w ? `${contentSize.w}px` : undefined, height: contentSize.h ? `${contentSize.h}px` : undefined }}
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
              } catch {}
            }, 0);
          } catch {}
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
            try { if (liveSelectedIds.length) setSelectedNodeIds(liveSelectedIds); } catch {}
            // Use mouse release point relative to the FlowEditor container (account for scroll)
            const host = canvasRef.current;
            const rect = host ? host.getBoundingClientRect() : { left: 0, top: 0 } as any;
            const scrollX = host ? host.scrollLeft : 0;
            const scrollY = host ? host.scrollTop : 0;
            const x = (e.clientX - rect.left) + scrollX;
            const y = (e.clientY - rect.top) + scrollY;
            setSelectionMenu({ show: true, x, y });
          } catch {}
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
          onCreateTask={() => { /* TODO: implement handling come originale */ }}
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
        <EdgeConditionMenu
          isOpen={connectionMenu.show}
          position={connectionMenu.position}
          onSelectCondition={handleSelectCondition}
          onSelectElse={() => {
            if (pendingEdgeIdRef.current) {
              setEdges((eds) => eds.map(e => e.id === pendingEdgeIdRef.current ? { ...e, label: 'Else', data: { ...(e.data||{}), isElse: true, onDeleteEdge } } : e));
              setSelectedEdgeId(pendingEdgeIdRef.current);
              pendingEdgeIdRef.current = null;
              closeMenu();
              return;
            }
            // Create a new node and connect with Else label (like handleSelectCondition)
            const sourceNodeId = connectionMenuRef.current.sourceNodeId || undefined;
            const sourceHandleId = connectionMenuRef.current.sourceHandleId || undefined;
            if (!sourceNodeId) { try { console.warn('[FlowEditor][Else] missing sourceNodeId'); } catch {} return; }

            const getTargetHandle = (sourceHandleId: string): string => {
              switch (sourceHandleId) {
                case 'bottom': return 'top-target';
                case 'top': return 'bottom-target';
                case 'left': return 'right-target';
                case 'right': return 'left-target';
                default: return 'top-target';
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
              data: { title: '', rows: [] }
            } as any;
            const newEdge = {
              id: newEdgeId,
              source: sourceNodeId,
              sourceHandle: sourceHandleId,
              target: newNodeId,
              targetHandle: getTargetHandle(sourceHandleId || ''),
              style: { stroke: '#8b5cf6' },
              label: 'Else',
              type: 'custom',
              data: { onDeleteEdge, isElse: true },
              markerEnd: 'arrowhead',
            } as Edge;
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
          }}
          onClose={handleConnectionMenuClose}
          seedItems={problemIntentSeedItems || []}
          extraItems={problemIntentSeedItems || []}
          sourceNodeId={connectionMenuRef.current.sourceNodeId as any}
          sourceRows={(() => {
            try {
              const id = connectionMenuRef.current.sourceNodeId as string | null;
              if (!id) return [] as any[];
              const node = nodesRef.current.find(n => n.id === id);
              return Array.isArray((node as any)?.data?.rows) ? (node as any).data.rows : [];
            } catch { return [] as any[]; }
          })()}
          onCreateCondition={handleCreateCondition}
        />
      )}
    </div>
  );
};

// Ref globale per edge temporaneo
const tempEdgeIdGlobal = { current: null as string | null };

// ✅ FIX: Flag per tracciare nodi temporanei stabilizzati (per evitare riposizionamento)
const stabilizedTempNodes = new Set<string>();

// ✅ FIX: Flag per tracciare nodi temporanei in corso di creazione (per evitare creazione duplicata)
const creatingTempNodes = new Set<string>();

// ✅ FIX: Flag globale rimosso - ora usiamo useRef (thread-safe)

export const FlowEditor: React.FC<FlowEditorProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowEditorContent {...props} />
    </ReactFlowProvider>
  );
};