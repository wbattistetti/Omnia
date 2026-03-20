import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodeProps, useReactFlow, NodeToolbar, Position } from 'reactflow';
import { NodeHeader } from './NodeHeader';
import { NodeDragHeader } from '../shared/NodeDragHeader';
import { NodeHandles } from '../../NodeHandles';
import { IntellisenseMenu } from '../../../Intellisense/IntellisenseMenu';
import { NodeRowData } from '../../../../types/project';
import { NodeRowList } from '../../rows/shared/NodeRowList';
import { useNodeState } from './hooks/useNodeState';
import { useNodeEventHandlers } from './hooks/useNodeEventHandlers';
import { useNodeInitialization } from './hooks/useNodeInitialization';
import { useNodeRowManagement } from './hooks/useNodeRowManagement';
import { useNodeIntellisense } from './hooks/useNodeIntellisense';
import { useNodeDragDrop } from './hooks/useNodeDragDrop';
import { useRowRegistry } from '../../rows/NodeRow/hooks/useRowRegistry';
import { useNodeRendering } from './hooks/useNodeRendering';
import { useNodeEffects } from './hooks/useNodeEffects';
import { useNodeExitEditing } from './hooks/useNodeExitEditing';
import { useRegisterAsNode } from '../../../../context/NodeRegistryContext';
import { useNodeExecutionHighlight } from '../../executionHighlight/useExecutionHighlight';
import { FlowStateBridge } from '../../../../services/FlowStateBridge';
import { useFlowActions } from '../../../../context/FlowActionsContext';
import { useCompilationErrors } from '../../../../context/CompilationErrorsContext';
import { taskRepository } from '../../../../services/TaskRepository';
import { useFlowSubflow } from '../../context/FlowSubflowContext';
import { SEMANTIC_DRAFT_FLUSH_EVENT } from '../../../../utils/semanticValuesRowState';
import { useProjectData, useProjectDataUpdate } from '../../../../context/ProjectDataContext';
import { ProjectDataService } from '../../../../services/ProjectDataService';
import { generateId } from '../../../../utils/idGenerator';
import { TaskType, type SemanticValue } from '../../../../types/taskTypes';
import { LinkStyle, type EdgeData } from '../../types/flowTypes';
import { variableCreationService } from '../../../../services/VariableCreationService';
import { useFlowCanvasId } from '../../context/FlowCanvasContext';

/**
 * Dati custom per un nodo del flowchart
 * @property label - titolo del nodo (ex title)
 * @property rows - array di righe (azioni/step)
 * @property isTemporary - true se nodo temporaneo
 * @property onDelete - callback per eliminare il nodo
 * @property onUpdate - callback per aggiornare i dati del nodo
 */
export interface CustomNodeData {
  label?: string;  // Node title (ex title)
  rows: NodeRowData[];
  isTemporary?: boolean;
  onDelete?: () => void;
  onUpdate?: (updates: any) => void;
  onPlayNode?: (nodeId: string) => void; // nuova prop opzionale
  hidden?: boolean; // render invisibile finché non riposizionato
  focusRowId?: string; // row da mettere in edit al mount
  hideUncheckedRows?: boolean; // nasconde le righe non incluse
  onCreateFactoryTask?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateBackendCall?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateTask?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
}

export const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({
  id,
  data,
  isConnectable,
  selected
}) => {
  const { onOpenSubflowForTask } = useFlowSubflow();
  const flowCanvasId = useFlowCanvasId();
  const { data: projectData } = useProjectData();
  const { addItem, addCategory, updateDataDirectly } = useProjectDataUpdate();
  // Context for node operations (with fallback to legacy)
  const flowActions = useFlowActions();

  // REGISTRY: Register node with NodeRegistry
  const nodeRegistryRef = useRegisterAsNode(id);

  // INITIALIZATION: Initialize node data and rows
  const { displayRows, normalizedData } = useNodeInitialization(id, data);

  // ✅ MEASURE NODE WIDTH: Track node width to prevent shrinking when editing
  const [nodeWidth, setNodeWidth] = useState<number | null>(null);
  const nodeWidthRef = useRef<number | null>(null);

  // ✅ MEASURE NODE HEIGHT: Track node height to adjust descendants when rows change
  const nodeHeightRef = useRef<number | null>(null);
  const previousRowsCountRef = useRef<number>(0);

  // ✅ ROW MANAGEMENT: Manage all row operations
  const rowManagement = useNodeRowManagement({ nodeId: id, normalizedData, displayRows });
  const {
    nodeRows, setNodeRows,
    editingRowId, setEditingRowId,
    isEmpty, setIsEmpty,
    handleUpdateRow, handleDeleteRow, handleInsertRow,
    handleExitEditing, updateNodeRows, validateRows, computeIsEmpty,
    inAutoAppend
  } = rowManagement;

  // ✅ Initialize previousRowsCountRef after nodeRows is available (safety net if nodeHeightRef initialization doesn't run)
  useEffect(() => {
    if (nodeHeightRef.current === null && previousRowsCountRef.current === 0) {
      previousRowsCountRef.current = nodeRows.length;
    }
  }, [nodeRows.length]);

  // ✅ INTELLISENSE: Manage intellisense functionality
  const intellisense = useNodeIntellisense({
    nodeRows,
    setNodeRows,
    editingRowId,
    normalizedData
  });
  const {
    showIntellisense, intellisensePosition,
    handleIntellisenseSelectItem, closeIntellisense
  } = intellisense;

  // Ref al contenitore delle righe per calcoli DnD locali (dichiarato prima dell'uso)
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);

  // ✅ CORREZIONE 5: Ref per il container root del nodo (dichiarato prima dell'uso)
  const rootRef = useRef<HTMLDivElement>(null);

  // ✅ CORREZIONE 6: Ref per il container del nodo (dichiarato prima dell'uso)
  const nodeContainerRef = useRef<HTMLDivElement>(null);

  // ✅ NODE DRAG: Hook per accedere a React Flow per aggiornare posizione nodo (deve essere prima di findAllDescendants)
  const { getNode, setNodes, setEdges, getViewport, getEdges } = useReactFlow();

  // ✅ Funzione per trovare tutti i discendenti di un nodo (ricorsivo) - deve essere prima del useEffect che la usa
  const findAllDescendants = useCallback((nodeId: string, visited: Set<string> = new Set()): string[] => {
    if (visited.has(nodeId)) return []; // Evita cicli
    visited.add(nodeId);

    const edges = getEdges();
    const descendants: string[] = [];

    // Trova tutti i nodi raggiungibili da questo nodo
    edges.forEach(edge => {
      if (edge.source === nodeId) {
        const targetId = edge.target;
        if (!visited.has(targetId)) {
          descendants.push(targetId);
          // Ricorsivamente trova i discendenti del target
          const nestedDescendants = findAllDescendants(targetId, visited);
          descendants.push(...nestedDescendants);
        }
      }
    });

    return descendants;
  }, [getEdges]);

  // ✅ Effect per spostare i discendenti quando cambia l'altezza del nodo
  useEffect(() => {
    // Aspetta che il DOM sia aggiornato
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!nodeContainerRef.current) return;

        const currentHeight = nodeContainerRef.current.getBoundingClientRect().height;
        const previousHeight = nodeHeightRef.current;
        const previousRowsCount = previousRowsCountRef.current;
        const currentRowsCount = nodeRows.length;

        // ✅ Solo se il numero di righe è cambiato (non durante editing)
        if (previousRowsCount !== currentRowsCount && previousHeight !== null) {
          const heightDelta = currentHeight - previousHeight;

          // ✅ Se l'altezza è cambiata, sposta i discendenti rigidamente
          if (Math.abs(heightDelta) > 1) { // Tolleranza di 1px per evitare micro-movimenti
            const descendants = findAllDescendants(id);

            if (descendants.length > 0) {
              // Sposta tutti i discendenti della stessa quantità
              setNodes((nds) => nds.map((n) => {
                if (descendants.includes(n.id)) {
                  return {
                    ...n,
                    position: {
                      x: n.position.x,
                      y: n.position.y + heightDelta
                    }
                  };
                }
                return n;
              }));
            }
          }
        }

        // ✅ Aggiorna l'altezza e il conteggio delle righe
        nodeHeightRef.current = currentHeight;
        previousRowsCountRef.current = currentRowsCount;
      });
    });
  }, [nodeRows.length, id, findAllDescendants, setNodes]);

  // ✅ Handler per aggiornare la larghezza del nodo (Regola 2: SOLO quando aumenta)
  const handleRowWidthChange = useCallback((width: number) => {
    if (!editingRowId || !nodeContainerRef.current) return;

    const currentWidth = nodeWidthRef.current || 140;

    // ✅ Regola 2: Aggiorna SOLO se la larghezza aumenta
    if (width > currentWidth) {
      requestAnimationFrame(() => {
        if (!nodeContainerRef.current) return;

        setNodeWidth(width);
        nodeWidthRef.current = width;

        // Aggiorna gli stili DOM
        nodeContainerRef.current.style.setProperty('min-width', `${width}px`, 'important');
        nodeContainerRef.current.style.setProperty('width', `${width}px`, 'important');
        nodeContainerRef.current.style.setProperty('flex-shrink', '0', 'important');
      });
    }
  }, [editingRowId]);

  // Measure node width ONLY when entering editing (not when exiting)
  useEffect(() => {
    if (!editingRowId) {
      // ✅ Punto 3: Quando NON si sta editando: mantieni la larghezza attuale, NON ricalcolare
      // Questo evita il restringimento post-ENTER
      if (nodeContainerRef.current && nodeWidthRef.current) {
        // Mantieni semplicemente la larghezza raggiunta
        const currentWidth = nodeWidthRef.current;
        nodeContainerRef.current.style.setProperty('min-width', `${currentWidth}px`, 'important');
        nodeContainerRef.current.style.setProperty('width', `${currentWidth}px`, 'important');
        nodeContainerRef.current.style.setProperty('flex-shrink', '0', 'important');
      } else if (nodeContainerRef.current && !nodeWidthRef.current) {
        // Solo al primo mount, misura la larghezza iniziale
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!nodeContainerRef.current) return;
            const rect = nodeContainerRef.current.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            setNodeWidth(width);
            nodeWidthRef.current = width;
            if (nodeHeightRef.current === null) {
              nodeHeightRef.current = height;
              previousRowsCountRef.current = nodeRows.length;
            }
          });
        });
      }
    } else {
      // ✅ Punto 3: Quando si entra in editing: imposta larghezza minima ma permette espansione
      if (!nodeContainerRef.current) return;

      const container = nodeContainerRef.current;
      const minWidth = nodeWidthRef.current || 140;

      container.style.setProperty('min-width', `${minWidth}px`, 'important');
      container.style.setProperty('width', 'auto', 'important'); // ✅ Permette espansione
      container.style.setProperty('flex-shrink', '0', 'important');
    }
  }, [editingRowId, id, nodeRows.length]);

  // ✅ TOOLBAR: Ref per l'elemento toolbar (dichiarato prima dell'uso)
  const toolbarElementRef = useRef<HTMLDivElement>(null);

  // ✅ NODE DRAG: Ref per gestire il drag personalizzato del nodo
  const nodeDragStateRef = useRef<{
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
    isActive: boolean;
    // ✅ Salva le posizioni relative dei discendenti per drag rigido
    descendantOffsets?: Map<string, { offsetX: number; offsetY: number }>;
  } | null>(null);

  // ✅ NODE DRAG: Cleanup listener quando il componente viene smontato
  React.useEffect(() => {
    return () => {
      if (nodeDragStateRef.current?.isActive) {
        // Cleanup se il componente viene smontato durante un drag
        document.body.style.cursor = 'default';
        nodeDragStateRef.current = null;
      }
    };
  }, []);

  // ✅ DRAG & DROP: Manage row drag and drop functionality
  const dragDrop = useNodeDragDrop({
    nodeRows,
    setNodeRows,
    data: normalizedData,
    rowsContainerRef,
    nodeId: id
  });
  const {
    draggedRowId, handleRowDragStart
  } = dragDrop;

  // ✅ STATE: Extract all state management to custom hook (MUST BE FIRST)
  const nodeState = useNodeState({ data: normalizedData });
  const {
    isEditingNode, setIsEditingNode,
    nodeTitle, setNodeTitle,
    isHoveredNode, setIsHoveredNode,
    setIsHoverHeader,
    isDragging, setIsDragging,
    isToolbarDrag, setIsToolbarDrag,
    showUnchecked, setShowUnchecked,
    hasTitle, showPermanentHeader, showDragHeader
  } = nodeState;

  // Event handlers extracted to custom hook
  const handlers = useNodeEventHandlers({
    nodeId: id,
    data: normalizedData,
    nodeTitle,
    setNodeTitle,
    setIsEditingNode,
    setIsHoverHeader,
    setIsHoveredNode,
    toolbarElementRef // Passo il ref della toolbar per verificare hover
  });
  const {
    handleEndTitleEditing,
    handleTitleUpdate,
    handleDeleteNode,
    handleNodeMouseEnter,
    handleNodeMouseLeave
  } = handlers;

  const ensureConditionsCategory = useCallback(async (): Promise<string | null> => {
    const conditions = (projectData as any)?.conditions || [];
    if (conditions.length > 0 && conditions[0]?.id) {
      return conditions[0].id;
    }
    await addCategory('conditions', 'Default Conditions');
    const refreshed = await ProjectDataService.loadProjectData();
    const updatedConditions = (refreshed as any)?.conditions || [];
    return updatedConditions[0]?.id || null;
  }, [projectData, addCategory]);

  const getCurrentProjectId = useCallback((): string | null => {
    try {
      const runtime = (window as any).__omniaRuntime?.getCurrentProjectId?.();
      if (runtime) return runtime;
    } catch {}
    try {
      const fromStorage = localStorage.getItem('currentProjectId');
      if (fromStorage) return fromStorage;
    } catch {}
    return null;
  }, []);

  const createConditionForValue = useCallback(async (
    categoryId: string,
    slotGuid: string,
    slotLabel: string,
    valueLabel: string
  ): Promise<string | null> => {
    const conditionName = `${slotLabel}: ${valueLabel}`;
    const escaped = valueLabel.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const executableCode = `[${slotGuid}] = "${escaped}"`;
    const compiledCode = `return ctx["${slotGuid}"] === "${escaped}";`;

    const created = await addItem('conditions', categoryId, conditionName, '', 'global');
    const conditionId = (created as any)?._id || (created as any)?.id;
    if (!conditionId) return null;

    const currentPd = JSON.parse(JSON.stringify((window as any).__projectData || projectData || {}));
    const categories = currentPd.conditions || [];
    let conditionPatched = false;
    for (const cat of categories) {
      if (cat.id !== categoryId) continue;
      const items = cat.items || [];
      const existingIdx = items.findIndex((item: any) => (item.id || item._id) === conditionId);
      if (existingIdx >= 0) {
        cat.items = items.map((item: any) => {
          if ((item.id || item._id) !== conditionId) return item;
          return {
            ...item,
            label: conditionName,
            expression: {
              executableCode,
              compiledCode,
              format: 'dsl',
            },
          };
        });
      } else {
        // The provider refresh can lag behind addItem; inject immediately so editor can open now.
        cat.items = [
          ...items,
          {
            ...(created as any),
            id: (created as any)?.id || (created as any)?._id || conditionId,
            _id: (created as any)?._id || (created as any)?.id || conditionId,
            label: conditionName,
            expression: {
              executableCode,
              compiledCode,
              format: 'dsl',
            },
          },
        ];
      }
      conditionPatched = true;
      break;
    }
    if (!conditionPatched) {
      throw new Error(`Conditions category not found while creating condition: ${categoryId}`);
    }
    updateDataDirectly(currentPd);

    const verifyConditions = (((window as any).__projectData || currentPd)?.conditions || [])
      .flatMap((cat: any) => cat.items || []);
    const existsNow = verifyConditions.some((item: any) => (item.id || item._id) === conditionId);
    if (!existsNow) {
      throw new Error(`Condition ${conditionId} was not visible in project data after creation.`);
    }

    return conditionId;
  }, [addItem, projectData, updateDataDirectly]);

  const handleAppendSemanticNodes = useCallback(async (row: NodeRowData, values: SemanticValue[]) => {
    if (!values.length) {
      return;
    }

    const parentNode = getNode(id);
    if (!parentNode) {
      window.alert('Parent node not found.');
      return;
    }

    const allEdges = getEdges();
    const existingEdgeLabels = new Set(
      allEdges
        .filter((e: any) => e.source === id)
        .map((e: any) => String(e.label || '').trim().toLowerCase())
    );

    const uniqueValues = values
      .map((v) => v.label.trim())
      .filter((label) => label.length > 0)
      .filter((label) => !existingEdgeLabels.has(label.toLowerCase()));

    if (!uniqueValues.length) {
      window.alert('All values already have outgoing branches from this node.');
      return;
    }

    const slotGuid = row.meta?.semanticSlotRefId || generateId();
    const projectId = getCurrentProjectId();
    if (projectId) {
      // Ensure GUID->label mapping exists so ConditionEditor can show readable labels.
      const normalizedSlotLabel = variableCreationService.normalizeTaskLabel(
        (row.text || 'slot').trim() || 'slot'
      );
      variableCreationService.ensureManualVariableWithId(
        projectId,
        slotGuid,
        normalizedSlotLabel,
        { scope: 'flow', scopeFlowId: flowCanvasId }
      );
    }
    updateNodeRows((rows) =>
      rows.map((r) => (
        r.id === row.id
          ? { ...r, meta: { ...(r.meta || {}), semanticSlotRefId: slotGuid } }
          : r
      ))
    );

    const categoryId = await ensureConditionsCategory();
    if (!categoryId) {
      throw new Error('Conditions category not available.');
    }

    const parentX = parentNode.position.x;
    const parentY = parentNode.position.y;
    const parentWidth = (parentNode as any)?.measured?.width || (parentNode as any)?.width || 260;
    const dy = 220;

    // Keep child strip centered on parent median using per-label width estimates.
    // This avoids visual drift caused by a single hardcoded child width.
    const estimateChildWidth = (label: string): number => {
      const approxCharWidth = 8.4; // aligned with node width heuristic (14px * 0.6)
      const padding = 40;
      return Math.max(140, Math.ceil(label.length * approxCharWidth + padding));
    };
    const childWidths = uniqueValues.map((label) => estimateChildWidth(label));
    const childGap = 120;
    const totalChildrenWidth = childWidths.reduce((acc, width) => acc + width, 0)
      + childGap * Math.max(0, uniqueValues.length - 1);
    const parentCenterX = parentX + parentWidth / 2;
    const stripStartX = parentCenterX - totalChildrenWidth / 2;

    const newNodes: any[] = [];
    const newEdges: any[] = [];
    const skipped: string[] = [];

    let cursorX = stripStartX;
    for (let i = 0; i < uniqueValues.length; i += 1) {
      const valueLabel = uniqueValues[i];
      const conditionId = await createConditionForValue(categoryId, slotGuid, row.text || 'slot', valueLabel);
      if (!conditionId) {
        skipped.push(valueLabel);
        continue;
      }

      const childNodeId = generateId();
      const childRowId = generateId();
      const childNodeWidth = childWidths[i];
      const childX = Math.round(cursorX);
      const childY = Math.round(parentY + dy);
      cursorX += childNodeWidth + childGap;

      newNodes.push({
        id: childNodeId,
        type: 'custom',
        position: { x: childX, y: childY },
        data: {
          label: '',
          rows: [
            {
              id: childRowId,
              text: valueLabel,
              included: true,
              heuristics: {
                type: TaskType.Flow,
                templateId: null,
              },
            },
          ],
          onDelete: () => flowActions?.deleteNode?.(childNodeId),
          onUpdate: (updates: any) => flowActions?.updateNode?.(childNodeId, updates),
          onCreateFactoryTask: data.onCreateFactoryTask,
          onCreateBackendCall: data.onCreateBackendCall,
          onCreateTask: data.onCreateTask,
          focusRowId: childRowId,
        },
      });

      newEdges.push({
        id: generateId(),
        source: id,
        sourceHandle: 'bottom',
        target: childNodeId,
        targetHandle: 'top-target',
        type: 'custom',
        label: valueLabel,
        markerEnd: 'arrowhead',
        conditionId,
        linkStyle: LinkStyle.VHV,
        data: {
          linkStyle: LinkStyle.VHV,
        } as EdgeData,
      });
    }

    if (!newNodes.length) {
      window.alert('No branches created. Conditions could not be created for selected values.');
      return;
    }

    setNodes((nds: any[]) => [...nds, ...newNodes]);
    setEdges((eds: any[]) => [...eds, ...newEdges]);

    if (skipped.length) {
      window.alert(`Created ${newNodes.length} branches, skipped ${skipped.length}.`);
    }
  }, [
    id,
    data.onCreateFactoryTask,
    data.onCreateBackendCall,
    data.onCreateTask,
    flowActions,
    getNode,
    getEdges,
    getCurrentProjectId,
    setNodes,
    setEdges,
    updateNodeRows,
    ensureConditionsCategory,
    createConditionForValue,
    flowCanvasId,
  ]);

  // ✅ RENDERING: Manage rendering logic and props (AFTER state and handlers)
  const rendering = useNodeRendering({
    nodeWidth: editingRowId ? nodeWidth : null,
    nodeRows,
    updateNodeRows,
    normalizedData,
    isHoveredNode,
    selected,
    isEditingNode,
    showPermanentHeader,
    showDragHeader,
    isDragging,
    isToolbarDrag,
    editingRowId,
    showIntellisense,
    intellisensePosition,
    handleIntellisenseSelectItem,
    closeIntellisense,
    handleRowDragStart,
    handleUpdateRow,
    handleDeleteRow,
    handleInsertRow,
    handleExitEditing,
    setIsEditingNode,
    handleDeleteNode,
    setIsHoveredNode,
    setIsHoverHeader,
    id,
    onAppendSemanticNodes: handleAppendSemanticNodes,
    isEmpty,
    onWidthChange: handleRowWidthChange
  });
  const {
    nodeRowListProps,
    intellisenseProps,
    nodeStyles,
    toolbarStyles,
    dragHeaderStyles
  } = rendering;

  // ✅ EFFECTS: Manage all useEffect logic (AFTER state)
  const effects = useNodeEffects({
    showPermanentHeader,
    hasTitle,
    isHoveredNode,
    isEditingNode,
    selected,
    id,
    nodeRows,
    editingRowId,
    normalizedData,
    isEmpty,
    inAutoAppend,
    computeIsEmpty,
    setIsHoverHeader,
    setIsHoveredNode,
    setNodeRows,
    setIsEmpty,
    setEditingRowId,
    rootRef,
    nodeContainerRef,
    exitEditing: handleExitEditing
  });
  const { nextPointerTargetRef } = effects;

  // ✅ EXIT EDITING: Extract exit editing logic to custom hook
  const { exitEditing } = useNodeExitEditing({
    inAutoAppend,
    nextPointerTargetRef,
    nodeContainerRef,
    handleExitEditing: (rowId?: string) => handleExitEditing(rowId || editingRowId || null),
    validateRows,
    nodeRows,
    editingRowId
  });

  // Stato per gestire l'inserter hover
  const [hoveredInserter, setHoveredInserter] = useState<number | null>(null);

  // Registry per accedere ai componenti NodeRow
  const { getRowComponent } = useRowRegistry();

  // TOGGLE UNCHECKED ROWS: Handle eye icon click
  const handleToggleUnchecked = useCallback(() => {
    const newShowUnchecked = !showUnchecked;
    setShowUnchecked(newShowUnchecked);

    // Update the node data via context or fallback
    if (flowActions?.updateNode) {
      flowActions.updateNode(id, { hideUncheckedRows: !newShowUnchecked });
    } else if (typeof data.onUpdate === 'function') {
      data.onUpdate({ hideUncheckedRows: !newShowUnchecked });
    }
  }, [showUnchecked, setShowUnchecked, id, data, flowActions]);

  // ✅ CHECK FOR UNCHECKED ROWS: Calculate if there are any unchecked rows
  const hasUncheckedRows = nodeRows.some(row => row.included === false);

  // ✅ EXECUTION HIGHLIGHT: Get execution highlight styles
  const executionHighlight = useNodeExecutionHighlight(id, nodeRows);

  // Sync row.meta after draft flush (TaskTreeOpener / task creation)
  React.useEffect(() => {
    const onFlush = (e: Event) => {
      const detail = (e as CustomEvent<{ rowId: string; nextRow: NodeRowData }>).detail;
      if (!detail?.rowId || !detail?.nextRow) return;
      if (!nodeRows.some((r) => r.id === detail.rowId)) return;
      const nextRows = nodeRows.map((r) => (r.id === detail.rowId ? detail.nextRow : r));
      setNodeRows(nextRows);
      queueMicrotask(() => {
        normalizedData.onUpdate?.({
          rows: nextRows,
          isTemporary: normalizedData.isTemporary,
        });
      });
    };
    window.addEventListener(SEMANTIC_DRAFT_FLUSH_EVENT, onFlush as EventListener);
    return () => window.removeEventListener(SEMANTIC_DRAFT_FLUSH_EVENT, onFlush as EventListener);
  }, [nodeRows, normalizedData, setNodeRows]);

  // ✅ CROSS-NODE DRAG: Listen for cross-node row moves - VERSIONE SEMPLIFICATA
  React.useEffect(() => {
    const handleCrossNodeMove = (event: CustomEvent) => {
      const { toNodeId, rowData, mousePosition } = event.detail;

      if (toNodeId === id && rowData) {

        // ✅ VERIFY: Controlla che il task esista quando la riga arriva nel nuovo nodo
        const taskId = rowData.id; // row.id === task.id
        const task = taskRepository.getTask(taskId);

        console.log('[CustomNode] 🔍 CROSS-NODE MOVE RECEIVED - Task verification', {
            rowId: rowData.id,
            taskId: taskId,
            taskExists: !!task,
            taskType: task?.type,
            toNodeId: id,
            rowData: {
                id: rowData.id,
                text: rowData.text,
                taskId: rowData.taskId,
                instanceId: rowData.instanceId
            }
        });

        // Verifica che la riga non esista già
        const existingRow = nodeRows.find(row => row.id === rowData.id);
        if (!existingRow) {
          // Calcola la posizione di inserimento basata sul mouse
          const elements = Array.from(rowsContainerRef.current?.querySelectorAll('.node-row-outer') || []) as HTMLElement[];
          const rects = elements.map((el) => ({
            idx: Number(el.dataset.index),
            top: el.getBoundingClientRect().top,
            height: el.getBoundingClientRect().height
          }));

          let targetIndex = nodeRows.length; // Default: alla fine
          if (mousePosition) {
            for (const r of rects) {
              if (mousePosition.y < r.top + r.height / 2) {
                targetIndex = r.idx;
                break;
              }
              targetIndex = r.idx + 1;
            }
          }

          // Insert at correct position
          const updatedRows = [...nodeRows];
          updatedRows.splice(targetIndex, 0, rowData);
          setNodeRows(updatedRows);

          // Update via context or fallback
          if (flowActions?.updateNode) {
            flowActions.updateNode(id, { rows: updatedRows });
          } else if (data.onUpdate) {
            data.onUpdate({ rows: updatedRows });
          }

          // Highlight row immediately after drop
          // Usa requestAnimationFrame per essere il più veloce possibile
          requestAnimationFrame(() => {
            const rowComponent = getRowComponent(rowData.id);
            if (rowComponent) {
              rowComponent.highlight();
            } else {
              // Fallback: se il componente non è ancora renderizzato, riprova dopo un frame
              requestAnimationFrame(() => {
                const rowComponentRetry = getRowComponent(rowData.id);
                if (rowComponentRetry) {
                  rowComponentRetry.highlight();
                }
              });
            }
          });
        } else {
          // Row already exists, skipping
        }
      }
    };

    window.addEventListener('crossNodeRowMove', handleCrossNodeMove as EventListener);
    return () => {
      window.removeEventListener('crossNodeRowMove', handleCrossNodeMove as EventListener);
    };
  }, [id, nodeRows, setNodeRows, data, rowsContainerRef, getRowComponent]);

  // Ref per il wrapper esterno (per calcolare posizione toolbar)
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ✅ LISTENER GLOBALE: Nascondi toolbar quando il mouse è sul canvas (con debouncing)
  useEffect(() => {
    let rafId: number | null = null;

    const handleCanvasMouseMove = (e: MouseEvent) => {
      // Debounce con requestAnimationFrame per ridurre il carico
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        // Usa elementFromPoint per verificare la posizione effettiva del mouse
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
        if (!el) return;

        // ✅ Verifica se il mouse è sopra il Response Editor o altri pannelli docked
        const isOverResponseEditor = el?.closest?.('[data-response-editor]') ||
          el?.closest?.('.response-editor-container') ||
          el?.closest?.('[data-dockable-panel]');
        if (isOverResponseEditor) {
          // Se il mouse è sopra il Response Editor, nascondi immediatamente la toolbar
          if (!selected) {
            setIsHoveredNode(false);
          }
          return;
        }

        // Verifica se il mouse è sul canvas (react-flow__pane ma non sui nodi)
        const isCanvas = el?.closest?.('.react-flow__pane') && !el?.closest?.('.react-flow__node');
        const isOverToolbar = el && toolbarElementRef.current && toolbarElementRef.current.contains(el as Node);
        const isOverNode = el && ((nodeContainerRef.current && nodeContainerRef.current.contains(el as Node)) || (wrapperRef.current && wrapperRef.current.contains(el as Node)));

        if (isCanvas && !selected && !isOverToolbar && !isOverNode) {
          setIsHoveredNode(false);
        }
      });
    };

    document.addEventListener('mousemove', handleCanvasMouseMove, true);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleCanvasMouseMove, true);
    };
  }, [selected, setIsHoveredNode]);

  // ✅ NEW: Verifica se il mouse è sopra ResponseEditor durante il movimento
  // Questo previene che la toolbar del nodo appaia quando il mouse è sopra il ResponseEditor
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // ✅ Se il nodo non è in hover, non serve verificare
      if (!isHoveredNode) return;

      // ✅ Verifica se il mouse è sopra il ResponseEditor
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      const isOverResponseEditor = el?.closest?.('[data-response-editor]');

      // ✅ Se il mouse è sopra ResponseEditor, nascondi la toolbar del nodo
      if (isOverResponseEditor) {
        setIsHoveredNode(false);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [isHoveredNode, setIsHoveredNode]);

  return (
    <>
      {/* Toolbar sopra il nodo - Usa NodeToolbar nativo di React Flow */}
      <NodeToolbar
        isVisible={(isHoveredNode || selected) && !isEditingNode}
        position={Position.Top}
        offset={0}
        align="start"
        style={{
          width: nodeContainerRef.current
            ? `${nodeContainerRef.current.offsetWidth}px`
            : '100%',
          zIndex: 1000,
          pointerEvents: 'auto',
          minHeight: '32px'
        }}
        className="node-toolbar-custom"
        onMouseEnter={() => {
          setIsHoveredNode(true);
        }}
        onMouseLeave={(e) => {
          // ✅ Mantieni la stessa logica custom per hover
          const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;

          // ✅ Verifica se il mouse è sopra il Response Editor
          const isOverResponseEditor = el?.closest?.('[data-response-editor]');
          if (isOverResponseEditor) {
            setIsHoveredNode(false);
            return;
          }

          // Verifica se il mouse è ancora sul nodo o sulla toolbar
          const isOverNode = el && ((nodeContainerRef.current && nodeContainerRef.current.contains(el as Node)) || (wrapperRef.current && wrapperRef.current.contains(el as Node)));
          const isOverToolbar = el && toolbarElementRef.current && toolbarElementRef.current.contains(el as Node);
          const isOverCanvas = el?.closest?.('.react-flow__pane') && !el?.closest?.('.react-flow__node');

          if (selected) {
            return;
          }

          if (isOverNode || isOverToolbar) {
            return;
          }

          if (isOverCanvas) {
            setIsHoveredNode(false);
            return;
          }

          const relatedTarget = e.relatedTarget as HTMLElement | null;
          const isGoingToNode = relatedTarget && nodeContainerRef.current && wrapperRef.current &&
            (nodeContainerRef.current.contains(relatedTarget) || wrapperRef.current.contains(relatedTarget));

          if (isGoingToNode) {
            return;
          }

          setIsHoveredNode(false);
        }}
      >
        <div
          ref={toolbarElementRef}
          data-toolbar-debug
          style={{ width: '100%' }}
        >
          <NodeDragHeader
            onEditTitle={() => setIsEditingNode(true)}
            onDelete={handleDeleteNode}
            compact={true}
            showDragHandle={false}
            fullWidth={true}
            isToolbarDrag={isToolbarDrag}
            showUnchecked={showUnchecked}
            onToggleUnchecked={handleToggleUnchecked}
            hasUncheckedRows={hasUncheckedRows}
            nodeRef={nodeContainerRef}
            nodeId={id}
            nodeRows={data.rows}
            onDragStart={() => {
              // ✅ Verifica che NON ci sia una riga in drag (PROTEZIONE CRITICA)
              const isDraggingRow = document.querySelector('.node-row-outer[data-being-dragged="true"]');
              if (isDraggingRow) {
                return;
              }

              // ✅ Ottieni la posizione corrente del nodo
              const currentNode = getNode(id);
              if (!currentNode) {
                return;
              }

              // ✅ Prepara stato per drag personalizzato
              const nodeEl = nodeContainerRef.current;
              if (!nodeEl) return;

              const nodeRect = nodeEl.getBoundingClientRect();
              const viewport = getViewport();

              // Check if this is a rigid drag (anchor) or normal (move)
              const isRigidDrag = FlowStateBridge.isRigidDrag();

              // ✅ Se è drag rigido, calcola le posizioni relative dei discendenti
              let descendantOffsets: Map<string, { offsetX: number; offsetY: number }> | undefined;
              if (isRigidDrag) {
                const descendants = findAllDescendants(id);
                descendantOffsets = new Map();

                descendants.forEach(descendantId => {
                  const descNode = getNode(descendantId);
                  if (descNode) {
                    descendantOffsets!.set(descendantId, {
                      offsetX: descNode.position.x - currentNode.position.x,
                      offsetY: descNode.position.y - currentNode.position.y
                    });
                  }
                });

                console.log('🔗 [RIGID_DRAG] Trovati discendenti', {
                  nodeId: id,
                  descendantsCount: descendants.length,
                  descendantIds: descendants,
                  timestamp: Date.now()
                });
              }

              nodeDragStateRef.current = {
                startX: nodeRect.left,
                startY: nodeRect.top,
                nodeStartX: currentNode.position.x,
                nodeStartY: currentNode.position.y,
                isActive: true,
                descendantOffsets
              };

              // Set flag and state
              FlowStateBridge.setToolbarDragNodeId(id);
              FlowStateBridge.setBlockNodeDrag(false);
              setIsDragging(true);
              setIsToolbarDrag(true);
              document.body.style.cursor = 'move';

              // ✅ Handler per mouse move - aggiorna posizione del nodo
              const handleMouseMove = (e: MouseEvent) => {
                // ✅ VERIFICA CRITICA: se inizia un drag di riga, annulla il drag del nodo
                const isDraggingRow = document.querySelector('.node-row-outer[data-being-dragged="true"]');
                if (isDraggingRow) {
                  handleMouseUp();
                  return;
                }

                if (!nodeDragStateRef.current?.isActive) return;

                // Calcola offset del mouse
                const deltaX = e.clientX - nodeDragStateRef.current.startX;
                const deltaY = e.clientY - nodeDragStateRef.current.startY;

                // Converti in coordinate React Flow (considera zoom)
                const flowDeltaX = deltaX / viewport.zoom;
                const flowDeltaY = deltaY / viewport.zoom;

                // Aggiorna posizione del nodo
                const newPosition = {
                  x: nodeDragStateRef.current.nodeStartX + flowDeltaX,
                  y: nodeDragStateRef.current.nodeStartY + flowDeltaY
                };

                // If rigid drag, also move all descendants maintaining relative positions
                const isRigidDrag = FlowStateBridge.isRigidDrag();
                if (isRigidDrag && nodeDragStateRef.current.descendantOffsets) {
                  setNodes((nds) => nds.map((n) => {
                    if (n.id === id) {
                      return { ...n, position: newPosition };
                    }
                    // ✅ Sposta i discendenti mantenendo l'offset relativo
                    const offset = nodeDragStateRef.current.descendantOffsets!.get(n.id);
                    if (offset) {
                      return {
                        ...n,
                        position: {
                          x: newPosition.x + offset.offsetX,
                          y: newPosition.y + offset.offsetY
                        }
                      };
                    }
                    return n;
                  }));
                } else {
                  // ✅ Drag normale: sposta solo il nodo
                  setNodes((nds) => nds.map((n) =>
                    n.id === id ? { ...n, position: newPosition } : n
                  ));
                }

                // ✅ NodeToolbar si aggiorna automaticamente durante il drag
              };

              // ✅ Handler per mouse up - termina il drag
              const handleMouseUp = () => {
                if (!nodeDragStateRef.current?.isActive) return;

                // Reset stato
                nodeDragStateRef.current.isActive = false;
                nodeDragStateRef.current = null;

                // Rimuovi listener
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);

                // Reset flag and state
                FlowStateBridge.setToolbarDragNodeId(null);
                FlowStateBridge.setDragMode(null);
                setIsDragging(false);
                setIsToolbarDrag(false);
                document.body.style.cursor = 'default';
              };

              // ✅ Aggiungi listener globali (capture per intercettare anche eventi sopra altri elementi)
              document.addEventListener('mousemove', handleMouseMove, { capture: true });
              document.addEventListener('mouseup', handleMouseUp, { capture: true });
            }}
          />
        </div>
      </NodeToolbar>
      <div
        ref={wrapperRef}
        style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => {
          setIsHoveredNode(true);
        }}
        onMouseLeave={(e) => {
          // ✅ Usa elementFromPoint invece di relatedTarget (più affidabile)
          const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;

          // ✅ Verifica se il mouse è sopra il Response Editor - nascondi immediatamente
          const isOverResponseEditor = el?.closest?.('[data-response-editor]');
          if (isOverResponseEditor) {
            setIsHoveredNode(false);
            return;
          }

          // Verifica dove è effettivamente il mouse
          const isOverToolbar = el && toolbarElementRef.current && toolbarElementRef.current.contains(el as Node);
          const isOverNode = el && ((nodeContainerRef.current && nodeContainerRef.current.contains(el as Node)) || (wrapperRef.current && wrapperRef.current.contains(el as Node)));
          const isOverCanvas = el?.closest?.('.react-flow__pane') && !el?.closest?.('.react-flow__node');

          // Se il nodo è selected, mantieni sempre visibile
          if (selected) {
            return;
          }

          // Se il mouse è ancora sulla toolbar o sul nodo, mantieni visibile
          if (isOverToolbar || isOverNode) {
            return;
          }

          // Se il mouse è sul canvas, nascondi immediatamente
          if (isOverCanvas) {
            setIsHoveredNode(false);
            return;
          }

          // Fallback: usa relatedTarget se elementFromPoint non funziona
          const relatedTarget = e.relatedTarget as HTMLElement | null;
          // ✅ Verifica che relatedTarget sia un Node valido prima di chiamare contains
          const isValidNode = relatedTarget && relatedTarget instanceof Node;
          const isGoingToToolbar = isValidNode && toolbarElementRef.current && toolbarElementRef.current.contains(relatedTarget);
          const isGoingToNodeContainer = isValidNode && nodeContainerRef.current && wrapperRef.current &&
            (nodeContainerRef.current.contains(relatedTarget) || wrapperRef.current.contains(relatedTarget));

          if (isGoingToToolbar || isGoingToNodeContainer) {
            return;
          }

            // Altrimenti nascondi
            setIsHoveredNode(false);
          }}
      >
        <div
          ref={(el) => {
            // ✅ Assign to ALL three refs in a single callback
            (rootRef as any).current = el;
            (nodeRegistryRef as any).current = el;
            (nodeContainerRef as any).current = el;
          }}
          data-id={id}
          className={`bg-white rounded-lg shadow-xl min-h-[40px] relative ${
            selected ? 'border-2' : 'border'
          } border-black`}
          style={{
            ...nodeStyles,
            // ✅ Priority: Execution highlight > Selection > Default
            border: executionHighlight.nodeBorder !== 'transparent'
              ? `${executionHighlight.nodeBorderWidth}px solid ${executionHighlight.nodeBorder}`
              : (selected ? '2px solid black' : '1px solid black'),
            backgroundColor: 'white' // ✅ Sempre bianco, non toccare
          }}
          tabIndex={-1}
          draggable={false}
          onMouseEnter={() => {
            setIsHoveredNode(true);
          }}
          onMouseLeave={(e) => {
            // ✅ Usa elementFromPoint invece di relatedTarget (più affidabile)
            const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;

            // Verifica dove è effettivamente il mouse
            const isOverToolbar = el && toolbarElementRef.current && toolbarElementRef.current.contains(el as Node);
            const isOverNode = el && ((wrapperRef.current && wrapperRef.current.contains(el as Node)) || (nodeContainerRef.current && nodeContainerRef.current.contains(el as Node)));
            const isOverCanvas = el?.closest?.('.react-flow__pane') && !el?.closest?.('.react-flow__node');

            // Se il nodo è selected, mantieni sempre visibile
            if (selected) {
              return;
            }

            // Se il mouse è ancora sulla toolbar o sul nodo, mantieni visibile
            if (isOverToolbar || isOverNode) {
              return;
            }

            // Se il mouse è sul canvas, nascondi immediatamente
            if (isOverCanvas) {
              setIsHoveredNode(false);
              return;
            }

          // Fallback: usa relatedTarget se elementFromPoint non funziona
          const relatedTarget = e.relatedTarget as HTMLElement | null;
          // ✅ Verifica che relatedTarget sia un Node valido prima di chiamare contains
          const isValidNode = relatedTarget && relatedTarget instanceof Node;
          const isGoingToToolbar = isValidNode && toolbarElementRef.current && toolbarElementRef.current.contains(relatedTarget);
          const isStillInWrapper = isValidNode && wrapperRef.current && nodeContainerRef.current &&
            (wrapperRef.current.contains(relatedTarget) || nodeContainerRef.current.contains(relatedTarget));

            if (isGoingToToolbar || isStillInWrapper) {
              return;
            }

            // Altrimenti nascondi
            setIsHoveredNode(false);
          }}
          onMouseDownCapture={(e) => {
            const t = e.target as HTMLElement;
            const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');

            // ✅ Solo blocca input, lascia passare tutto il resto (incluso nodrag) alla label
            if (isInput) {
              e.stopPropagation();
            }
            // ✅ NON bloccare nodrag - l'evento deve arrivare alla label che gestirà stopPropagation
          }}
          onMouseUpCapture={(e) => {
            if (!editingRowId) return;
            const t = e.target as HTMLElement;
            const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
            if (isInput) e.stopPropagation();
          }}
          onFocusCapture={() => { }}
        >
          {/* Header permanente: DENTRO il nodo come fascia colorata in alto */}
          {showPermanentHeader && (
            <div
              onMouseEnter={() => setIsHoverHeader(true)}
              onMouseLeave={() => setIsHoverHeader(false)}
            >
              <NodeHeader
                title={nodeTitle}
                onDelete={handleDeleteNode}
                onToggleEdit={handleEndTitleEditing}
                onTitleUpdate={handleTitleUpdate}
                isEditing={isEditingNode}
                startEditingTitle={isEditingNode}
                hasUnchecked={nodeRows.some(r => r.included === false)}
                hideUnchecked={(data as any)?.hideUncheckedRows === true}
                onToggleHideUnchecked={() => {
                  if (flowActions?.updateNode) {
                    flowActions.updateNode(id, { hideUncheckedRows: !(data as any)?.hideUncheckedRows });
                  } else if (typeof data.onUpdate === 'function') {
                    data.onUpdate({ hideUncheckedRows: !(data as any)?.hideUncheckedRows });
                  }
                }}
              />
            </div>
          )}

          {/* Header drag handled by toolbar above the node */}
          <div className="px-1.5" ref={rowsContainerRef}>
            <NodeRowList
              {...nodeRowListProps}
              hoveredInserter={hoveredInserter}
              setHoveredInserter={setHoveredInserter}
              nodeTitle={nodeTitle}
              hideUnchecked={!showUnchecked}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  return;
                } else if (e.key === 'Escape') {
                  const singleEmpty = nodeRows.length === 1 && nodeRows[0].text.trim() === '';
                  if (singleEmpty) {
                    if (flowActions?.deleteNode) {
                      flowActions.deleteNode(id);
                    } else {
                      data.onDelete?.();
                    }
                  } else {
                    exitEditing();
                  }
                }
              }}
              canDelete={() => nodeRows.length > 1}
              totalRows={nodeRows.length}
              onCreateFactoryTask={data.onCreateFactoryTask}
              onCreateBackendCall={data.onCreateBackendCall}
              onCreateTask={data.onCreateTask}
              onOpenSubflowForTask={onOpenSubflowForTask}
              getProjectId={() => {
                try { return (window as any).__omniaRuntime?.getCurrentProjectId?.() || null; } catch { return null; }
              }}
              hoveredRowIndex={null}
              draggedRowId={draggedRowId}
              draggedRowOriginalIndex={null}
              draggedItem={null}
              draggedRowStyle={{}}
              onEditingEnd={exitEditing}
            />
          </div>
          <NodeHandles isConnectable={isConnectable} />
          {showIntellisense && <IntellisenseMenu {...intellisenseProps} />}
        </div>
      </div>
    </>
  );
};