// useConditionCreation.ts
import { useCallback } from 'react';
import { useProjectDataUpdate, useProjectData } from '../../../context/ProjectDataContext';
import { ProjectDataService } from '../../../services/ProjectDataService';
import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge } from 'reactflow';
import type { NodeData, EdgeData } from '../types/flowTypes';

export function useConditionCreation(
  setEdges: any,
  setSelectedEdgeId: any,
  connectionMenuRef: any,
  reactFlowInstance: any,
  nodesRef: any,
  setNodes: any,
  deleteNodeWithLog: any,
  updateNode: any,
  createAgentAct: any,
  createBackendCall: any,
  createTask: any,
  createCondition: any,
  nodeIdCounter: number,
  setNodeIdCounter: any,
  pendingEdgeIdRef: any,
  closeMenu: () => void,
  tempFlags: any,
  setNodesWithLog: any,
  removeAllTempEdges: (eds: any[], currentNodes: any[]) => any[],
  edges: any[],
  onDeleteEdge: any
) {
  const { addItem, addCategory } = useProjectDataUpdate();
  const { data: projectData } = useProjectData();

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
        try { (await import('../../../ui/events')).emitSidebarOpenAccordion('conditions'); } catch {}

        // Aggiungi la nuova condizione
        await addItem('conditions', categoryId, name, '', scope);
        try { console.log('[CondFlow] service.created', { categoryId, name }); } catch {}

        // Ricarica dati per ottenere l'ID della nuova condizione
        const refreshed = await ProjectDataService.loadProjectData();
        const refCat = (refreshed as any)?.conditions?.find((c:any)=>c.id===categoryId);
        const created = refCat?.items?.find((i:any)=>i.name===name);
        const conditionId = created?._id || created?.id;

        // Evidenzia nel sidebar e aggiorna UI (non blocca il flusso)
        setTimeout(async () => { try { (await import('../../../ui/events')).emitSidebarHighlightItem('conditions', name); } catch {} }, 100);
        try { (await import('../../../ui/events')).emitSidebarForceRender(); } catch {}

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
  }, [projectData, addItem, addCategory, setEdges, setSelectedEdgeId, pendingEdgeIdRef, closeMenu, nodeIdCounter, reactFlowInstance, connectionMenuRef, deleteNodeWithLog, updateNode, onDeleteEdge, setNodes, nodesRef, setNodeIdCounter, createAgentAct, createBackendCall, createTask, createCondition, tempFlags, setNodesWithLog, removeAllTempEdges, edges]);

  return { handleCreateCondition };
}
