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
import { useProjectDataUpdate, useProjectData } from '../../context/ProjectDataContext';
import { ProjectDataService } from '../../services/ProjectDataService';
import { useEntityCreation } from '../../hooks/useEntityCreation';
import { dlog } from '../../utils/debug';
import { findAgentAct, resolveActType } from './actVisuals';

export type { NodeData } from '../../hooks/useNodeManager';

// Definizione stabile di nodeTypes e edgeTypes per evitare warning React Flow
const nodeTypes = { custom: CustomNode, task: TaskNode };
const edgeTypes = { custom: CustomEdge };
export type { EdgeData } from '../../hooks/useEdgeManager';

// nodeTypes/edgeTypes memoized below

interface FlowEditorProps {
  flowId?: string;
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
  onCreateTaskFlow?: (flowId: string, title: string, nodes: any[], edges: any[]) => void;
  onOpenTaskFlow?: (flowId: string, title: string) => void;
}

const FlowEditorContent: React.FC<FlowEditorProps> = ({
  flowId,
  testPanelOpen,
  setTestPanelOpen,
  testNodeId,
  setTestNodeId,
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
  React.useEffect(() => {
    try { if (localStorage.getItem('debug.conn')==='1') console.log('[Conn][state]', connectionMenu); } catch {}
  }, [connectionMenu]);

  // Ref per memorizzare l'ID dell'ultima edge creata (sia tra nodi esistenti che con nodo temporaneo)
  const pendingEdgeIdRef = useRef<string | null>(null);
  // Ref sempre aggiornato con edges correnti (evita closure stale nei deduce temp)
  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Deferred apply for labels on just-created edges (avoids race with RF state)
  const pendingApplyRef = useRef<null | { id: string; label: string; data?: any; tries: number }>(null);
  const scheduleApplyLabel = useCallback((edgeId: string, label: string, extraData?: any) => {
    pendingApplyRef.current = { id: edgeId, label, data: extraData, tries: 0 };
    const tick = () => {
      const cur = pendingApplyRef.current;
      if (!cur) return;
      const exists = (edgesRef.current || []).some(e => e.id === cur.id);
      if (exists) {
        setEdges(eds => eds.map(e => e.id === cur.id ? { ...e, label: cur.label, data: cur.data ? { ...(e.data || {}), ...cur.data } : e.data } : e));
        setSelectedEdgeId(cur.id);
        pendingEdgeIdRef.current = null;
        pendingApplyRef.current = null;
        return;
      }
      if (cur.tries >= 12) { // ~2 frames fallback
        // As a fallback, try to match by src/tgt currently recorded
        const src = connectionMenuRef.current.sourceNodeId;
        const tgt = connectionMenuRef.current.targetNodeId;
        if (src && tgt) {
          setEdges(eds => eds.map(e => (e.source === src && e.target === tgt) ? { ...e, label: cur.label, data: cur.data ? { ...(e.data || {}), ...cur.data } : e.data } : e));
        }
        pendingEdgeIdRef.current = null;
        pendingApplyRef.current = null;
        return;
      }
      pendingApplyRef.current = { ...cur, tries: cur.tries + 1 };
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  }, [setEdges, setSelectedEdgeId]);

  // Also attempt apply on every edges change (fast path)
  useEffect(() => {
    const cur = pendingApplyRef.current;
    if (!cur) return;
    if ((edges || []).some(e => e.id === cur.id)) {
      setEdges(eds => eds.map(e => e.id === cur.id ? { ...e, label: cur.label, data: cur.data ? { ...(e.data || {}), ...cur.data } : e.data } : e));
      setSelectedEdgeId(cur.id);
      pendingEdgeIdRef.current = null;
      pendingApplyRef.current = null;
    }
  }, [edges, setEdges]);

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
        console.log('[🔍 STABILIZE.1] Node stabilization complete', { 
          tempNodeId, 
          totalNodes: stabilizedNodes.length,
          timestamp: Date.now()
        });
        return stabilizedNodes;
      });
      console.log('[Conn][finalize.temp]', { tempNodeId, finalPosition: nds.find(n => n.id === tempNodeId)?.position });
      setEdges(eds => eds.map(e => e.id === tempEdgeId ? { ...e, label, style: { ...(e.style || {}), stroke: '#8b5cf6' } } : e));
      finalizeTempPromotion(tempNodeId, tempEdgeId);
      connectionMenuRef.current.tempNodeId = null as any;
      connectionMenuRef.current.tempEdgeId = null as any;
      return true;
    }
    // 3) Existing nodes registered
    const src = connectionMenuRef.current.sourceNodeId;
    const tgt = connectionMenuRef.current.targetNodeId;
    if (src && tgt) {
      setEdges(eds => {
        const exists = eds.some(e => e.source === src && e.target === tgt);
        if (exists) return eds.map(e => (e.source === src && e.target === tgt) ? { ...e, label } : e);
        const id = uuidv4();
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
      return true;
    }
    return false;
  }, [setEdges, setNodes, finalizeTempPromotion, connectionMenuRef, onDeleteEdge]);

  // --- Undo/Redo command stack ---
  type Command = { label: string; do: () => void; undo: () => void };
  const [undoStack, setUndoStack] = useState<Command[]>([]);
  const [redoStack, setRedoStack] = useState<Command[]>([]);
  const executeCommand = useCallback((cmd: Command) => {
    try { cmd.do(); } finally { setUndoStack((s) => [...s, cmd]); setRedoStack([]); }
  }, []);
  const undo = useCallback(() => {
    let toUndo: Command | null = null;
    setUndoStack((s) => {
      if (s.length === 0) return s;
      toUndo = s[s.length - 1];
      return s.slice(0, -1);
    });
    if (toUndo) {
      try { toUndo.undo(); } catch {}
      setRedoStack((r) => [...r, toUndo as Command]);
    }
  }, []);
  const redo = useCallback(() => {
    let toDo: Command | null = null;
    setRedoStack((r) => {
      if (r.length === 0) return r;
      toDo = r[r.length - 1];
      return r.slice(0, -1);
    });
    if (toDo) {
      try { toDo.do(); } catch {}
      setUndoStack((s) => [...s, toDo as Command]);
    }
  }, []);
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

  // Sostituisco onConnect
  const onConnect = useCallback(
    (params: Connection) => {
      // Se esiste già una edge identica, usa quella; altrimenti crea nuova
      const existing = (edgesRef.current || []).find(e =>
        e.source === (params.source || '') &&
        e.target === (params.target || '') &&
        (e.sourceHandle || undefined) === (params.sourceHandle || undefined) &&
        (e.targetHandle || undefined) === (params.targetHandle || undefined)
      );
      if (existing) {
        pendingEdgeIdRef.current = existing.id;
      } else {
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
      }
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
        // Registra anche il bersaglio per consentire aggiornamenti deterministici
        try { setTarget(params.target, params.targetHandle || undefined); } catch {}
      }
    },
    [addEdgeManaged, onDeleteEdge, openMenu, setTarget],
  );

  // Log dettagliato su ogni cambiamento di nodes.length
  useEffect(() => {
    if (reactFlowInstance) {
      const viewport = reactFlowInstance.getViewport ? reactFlowInstance.getViewport() : { x: 0, y: 0, zoom: 1 };
      const viewportEl = document.querySelector('.react-flow') as HTMLElement;
      const rect = viewportEl ? viewportEl.getBoundingClientRect() : null;
    }
  }, [nodes.length, reactFlowInstance]);

  // Wrapper per setNodes con logging dettagliato e lock interno
  const setNodesWithLog = useCallback((updater: any) => {
    // ✅ LOCK INTERNO per prevenire chiamate duplicate in React StrictMode
    if (isCreatingTempNode.current) {
      console.log("🚫 [SET_NODES] BLOCKED - Node creation already in progress");
      return;
    }
    
    isCreatingTempNode.current = true;
    
    if (typeof updater === 'function') {
      setNodes((currentNodes) => {
        const newNodes = updater(currentNodes);
        
        // Log solo per cambiamenti di posizione significativi sui nodi temporanei
        currentNodes.forEach((oldNode, index) => {
          const newNode = newNodes[index];
          if (newNode && (newNode.data as any)?.isTemporary) {
            const positionChanged = oldNode.position.x !== newNode.position.x || oldNode.position.y !== newNode.position.y;
            if (positionChanged) {
              console.log("⚠️ [POSITION] Temporary node position changed", {
                nodeId: newNode.id,
                oldPosition: oldNode.position,
                newPosition: newNode.position,
                deltaX: newNode.position.x - oldNode.position.x,
                deltaY: newNode.position.y - oldNode.position.y,
                timestamp: Date.now()
              });
            }
          }
        });
        
        // ✅ UNLOCK posticipato
        queueMicrotask(() => {
          isCreatingTempNode.current = false;
        });
        
        return newNodes;
      });
    } else {
      setNodes(updater);
      // ✅ UNLOCK posticipato
      queueMicrotask(() => {
        isCreatingTempNode.current = false;
      });
    }
  }, [setNodes]);

  // Log su addNodeAtPosition e deleteNode
  const { addNode, deleteNode, updateNode, addNodeAtPosition: originalAddNodeAtPosition } = useNodeManager(setNodesWithLog, setNodeIdCounter);
  
  // ✅ FIX: Variabile mancante per lock interno
  const isCreatingTempNode = useRef(false);
  
  const addNodeAtPosition = useCallback((node: Node<NodeData>, x: number, y: number) => {
    originalAddNodeAtPosition(node, x, y);
  }, [originalAddNodeAtPosition]);
  const deleteNodeWithLog = useCallback((id: string) => {
    deleteNode(id);
  }, [deleteNode]);

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
      const pcRow = rows.find(r => (r?.type === 'ProblemClassification') || (resolveActType(r, null as any) === 'ProblemClassification'));
      if (!pcRow) return undefined;

      // 2) id atto
      const actId = pcRow.baseActId || pcRow.actId || pcRow.factoryId || pcRow.id;
      if (!actId) return undefined;

      // 3) prova direttamente dal project data (atto agganciato alla riga)
      let intents: any[] | undefined;
      const act = projectData ? findAgentAct(projectData as any, pcRow) : null;
      if (act && (act as any)?.problem?.intents?.length) intents = (act as any).problem.intents;

      // 4) fallback locale: shadow salvato dall'editor
      if (!intents || !intents.length) {
        const pid = (()=>{ try { return localStorage.getItem('current.projectId') || ''; } catch { return ''; } })();
        const keys = [`problem.${pid}.${actId}`, `problem.${pid}.${pcRow.id}`];
        for (const k of keys) {
          const raw = (()=>{ try { return localStorage.getItem(k); } catch { return null; } })();
          if (!raw) continue;
          try {
            const payload = JSON.parse(raw);
            if (Array.isArray(payload?.intents) && payload.intents.length) { intents = payload.intents; break; }
          } catch {}
        }
      }

      if (!intents || !intents.length) return undefined;
      return intents.map((int: any) => ({
        id: `intent-${int.id || int.name}`,
        label: int.name,
        shortLabel: int.name,
        name: int.name,
        description: int.name,
        category: 'Problem Intents',
        categoryType: 'conditions' as const,
        color: '#f59e0b',
      }));
    } catch { return undefined; }
  }, [nodes, projectData, connectionMenu.show, connectionMenu.sourceNodeId]);
  
  // Hook centralizzato per la creazione di entità (solo se il context è pronto)
  const entityCreation = useEntityCreation();
  const { createAgentAct, createBackendCall, createTask, createCondition } = entityCreation;

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
            finalPosition: nds.find(n => n.id === tempNodeId)?.position,
            nodeData: nds.find(n => n.id === tempNodeId)?.data
          });
          
          console.log('[🔍 STABILIZE_NODE] Stabilizing temporary node', {
            tempNodeId,
            tempEdgeId,
            conditionName: name,
            timestamp: Date.now()
          });
          
          // ✅ FIX: Marca il nodo come stabilizzato per evitare riposizionamento
          stabilizedTempNodes.add(tempNodeId);
          
          // ✅ FIX: Rimuovi il flag di creazione in corso
          creatingTempNodes.delete(tempNodeId);
          
          setNodesWithLog((nds) => {
            const updatedNodes = nds.map(n => {
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

  const onConnectStart = useCallback((event: any, { nodeId, handleId }: any) => {
    setSource(nodeId || '', handleId || undefined);
  }, []);

  // Rimuove TUTTI i nodi temporanei senza contenuto e i relativi edge (ESC/chiusura menu)
  function cleanupAllTempNodesAndEdges() {
    // Se è in corso una conferma (lock), non eseguire cleanup
    try { if ((connectionMenuRef.current as any)?.locked) return; } catch {}
    
    // ✅ FIX: Pulisci i flag di creazione in corso
    creatingTempNodes.clear();
    
    // 1) Rimuovi qualsiasi nodo temporaneo che non ha contenuto
    setNodes((nds) => nds.filter((n: any) => {
      const isTemp = n?.data?.isTemporary === true;
      if (!isTemp) return true;
      const rows = Array.isArray(n?.data?.rows) ? n.data.rows : [];
      const hasContent = rows.some((r: any) => (r?.text || '').trim().length > 0);
      return hasContent; // mantieni solo i temporanei che hanno già contenuto
    }));

    // 2) Rimuovi tutti gli edge collegati a nodi ancora temporanei
    setEdges((eds) => {
      const currentNodes = nodesRef.current;
      return eds.filter((e) => {
        const target = currentNodes.find((n) => n.id === e.target);
        return !(target && target.data && target.data.isTemporary === true);
      });
    });

    // 3) Azzera i riferimenti temporanei per evitare riusi inconsistenti
    try {
      connectionMenuRef.current.tempNodeId = null as any;
      connectionMenuRef.current.tempEdgeId = null as any;
      (window as any).__flowLastTemp = null;
      (tempEdgeIdGlobal as any).current = null;
    } catch {}
  }

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
      (tempEdgeIdGlobal as any).current = null;
    } catch {}
    // 4) cleanup di sicurezza
    cleanupAllTempNodesAndEdges();
  }

  // ✅ FIX: Hook custom enterprise-ready per lock asincrono
  function useNodeCreationLock() {
    const isLocked = useRef(false);

    const withNodeLock = useCallback(async (fn: () => Promise<void> | void) => {
      if (isLocked.current) {
        console.log("🚫 [LOCK] DUPLICATE BLOCKED - Node creation already in progress");
        return;
      }
      
      isLocked.current = true;
      console.log("🔒 [LOCK] ACQUIRED - Starting node creation");
      
      try {
        await fn();
      } finally {
        // Delay unlock to avoid race conditions
        queueMicrotask(() => {
          isLocked.current = false;
          console.log("🔓 [LOCK] RELEASED - Node creation completed");
        });
      }
    }, []);

    return withNodeLock;
  }

  const withNodeLock = useNodeCreationLock();

  // ✅ FIX: Funzione separata per creare nodo temporaneo CON LOCK INTERNO
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
    
    // Aggiungi nodo e edge (PROTETTO DAL LOCK INTERNO)
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
    tempEdgeIdGlobal.current = tempEdgeId;
    try { (connectionMenuRef.current as any).flowPosition = posFlow; } catch {}
    
    return { tempNodeId, tempEdgeId, position };
  }, [reactFlowInstance, setNodesWithLog, setEdges, onDeleteEdge, connectionMenuRef]);

  // ✅ FIX: Funzione separata per aprire intellisense
  const openIntellisense = useCallback((tempNodeId: string, tempEdgeId: string, event: any) => {
    console.log("🎯 [INTELLISENSE] Opening menu", { 
      tempNodeId, 
      tempEdgeId, 
      mousePos: { x: event.clientX, y: event.clientY },
      timestamp: Date.now()
    });
    
    // Registra i temp
    setTemp(tempNodeId, tempEdgeId);
    
    // Apri il menu
    openMenu({ x: event.clientX, y: event.clientY }, connectionMenuRef.current.sourceNodeId, connectionMenuRef.current.sourceHandleId);
    
    // Registra di nuovo dopo apertura
    setTemp(tempNodeId, tempEdgeId);
    
    try {
      (connectionMenuRef.current as any).tempNodeId = tempNodeId;
      (connectionMenuRef.current as any).tempEdgeId = tempEdgeId;
      (window as any).__flowLastTemp = { nodeId: tempNodeId, edgeId: tempEdgeId };
    } catch {}
    
    console.log("✅ [INTELLISENSE] Menu opened successfully", { 
      tempNodeId, 
      tempEdgeId,
      timestamp: Date.now()
    });
  }, [openMenu, setTemp, connectionMenuRef]);

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
    
    // Prima di tutto, pulisci eventuali edge/nodi temporanei rimasti
    cleanupAllTempNodesAndEdges();
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
        const { tempNodeId, tempEdgeId } = await createTemporaryNode(event);
        openIntellisense(tempNodeId, tempEdgeId, event);
      });
    } else {
      console.log("❌ [ON_CONNECT_END] Not creating node - conditions not met");
    }
  }, [withNodeLock, createTemporaryNode, openIntellisense, connectionMenuRef]);

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
    // usa la posizione flow del rilascio se presente, così il nodo compare esattamente lì
    const fp = (connectionMenuRef.current as any).flowPosition;
    const position = fp ? { x: fp.x - 140, y: fp.y - 20 } : reactFlowInstance.screenToFlowPosition({ x: connectionMenuRef.current.position.x - 140, y: connectionMenuRef.current.position.y - 20 });

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
  // Spostati fuori dal componente per evitare ricreazioni durante HMR

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
        <div className="absolute z-20 flex items-center gap-1" style={{ left: selectionMenu.x, top: selectionMenu.y, transform: 'translate(8px, 8px)' }}>
          <button
            className="px-2 py-1 text-xs rounded border bg-white border-slate-300 text-slate-700 shadow-sm"
            onClick={() => {
              try {
                // Clear both selection rectangles when creating the Task
                setPersistedSel(null);
                dlog('flow', '[CreateTask] click', { selectedNodeIds });
                const sel = nodes.filter(n => selectedNodeIds.includes(n.id));
                if (sel.length === 0) return;
                const minX = Math.min(...sel.map(n => (n.position as any).x));
                const minY = Math.min(...sel.map(n => (n.position as any).y));
                const maxX = Math.max(...sel.map(n => (n.position as any).x));
                const maxY = Math.max(...sel.map(n => (n.position as any).y));
                const cx = (minX + maxX) / 2;
                const cy = (minY + maxY) / 2;

                const selSet = new Set(selectedNodeIds);
                const internalEdges = edges.filter(e => selSet.has(e.source) && selSet.has(e.target));
                const inEdges = edges.filter(e => !selSet.has(e.source) && selSet.has(e.target));
                const outEdges = edges.filter(e => selSet.has(e.source) && !selSet.has(e.target));

                const originalEdges = edges; // snapshot per undo
                const taskId = `task_${Date.now()}`;
                // Prepara payload per il sotto-flusso (nodi/edge interni)
                const subflowNodes = sel.map(n => ({ ...n }));
                const subflowEdges = internalEdges.map(e => ({ ...e }));
                dlog('flow', '[CreateTask] prepared', { taskId, nodes: subflowNodes.map(n => n.id), edges: subflowEdges.map(e => e.id) });

                let selfCmdRef: Command | null = null;
                const cmd: Command = {
                  label: 'Collapse to Task',
                  do: () => {
                    setNodes(nds => {
                      const filtered = nds.filter(n => !selSet.has(n.id));
                      const onCommitTitle = (finalTitle: string) => {
                        // assicurati di invocare dopo il tick per evitare conflitti
                        setTimeout(() => {
                          try { onCreateTaskFlow && onCreateTaskFlow(taskId, finalTitle, subflowNodes as any, subflowEdges as any); } catch {}
                        }, 0);
                      };
                      const onCancelTitle = () => {
                        // Se la command è già in stack, rimuovila e ripristina manualmente
                        setUndoStack((s) => {
                          if (s.length && s[s.length - 1] === selfCmdRef) return s.slice(0, -1);
                          return s;
                        });
                        // Ripristina lo stato come nell'undo
                        setNodes(nds2 => {
                          const withoutTask = nds2.filter(n => n.id !== taskId);
                          return [...withoutTask, ...sel];
                        });
                        setEdges(eds2 => {
                          const mapped = eds2.map(x => {
                            const orig = originalEdges.find(o => o.id === x.id);
                            return orig ? { ...x, source: orig.source, target: orig.target, sourceHandle: orig.sourceHandle, targetHandle: orig.targetHandle, data: orig.data } : x;
                          });
                          const base = mapped.filter(x => x.source !== taskId && x.target !== taskId);
                          return [...base, ...internalEdges];
                        });
                        setSelectedNodeIds(selectedNodeIds);
                      };
                      const newNode = {
                        id: taskId,
                        type: 'task' as const,
                        position: { x: cx, y: cy },
                        data: {
                          title: '',
                          flowId: taskId,
                          editingToken: String(Date.now()),
                          onUpdate: (updates: any) => updateNode(taskId, updates),
                          onCommitTitle,
                          onCancelTitle
                        }
                      };
                      return [...filtered, newNode as any];
                    });
                    setEdges(eds => {
                      let filtered = eds.filter(e => !internalEdges.some(i => i.id === e.id));
                      inEdges.forEach(e => { filtered = filtered.map(x => x.id === e.id ? { ...x, target: taskId, targetHandle: e.targetHandle } : x); });
                      outEdges.forEach(e => { filtered = filtered.map(x => x.id === e.id ? { ...x, source: taskId, sourceHandle: e.sourceHandle } : x); });
                      return filtered;
                    });
                    setSelectedNodeIds([]);
                  },
                  undo: () => {
                    setNodes(nds => {
                      const withoutTask = nds.filter(n => n.id !== taskId);
                      return [...withoutTask, ...sel];
                    });
                    setEdges(eds => {
                      // Mappa prima agli endpoint originali, poi filtra eventuali edge ancora collegate al task
                      const mapped = eds.map(x => {
                        const orig = originalEdges.find(o => o.id === x.id);
                        return orig ? { ...x, source: orig.source, target: orig.target, sourceHandle: orig.sourceHandle, targetHandle: orig.targetHandle, data: orig.data } : x;
                      });
                      const base = mapped.filter(x => x.source !== taskId && x.target !== taskId);
                      return [...base, ...internalEdges];
                    });
                    setSelectedNodeIds(selectedNodeIds);
                  }
                };
                selfCmdRef = cmd;
                executeCommand(cmd);
                setSelectionMenu({ show: false, x: 0, y: 0 });
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
          seedItems={problemIntentSeedItems}
          extraItems={problemIntentSeedItems}
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