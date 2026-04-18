import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
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
import { useFlowSubflow } from '../../context/FlowSubflowContext';
import { SEMANTIC_DRAFT_FLUSH_EVENT } from '../../../../utils/semanticValuesRowState';
import { useProjectData, useProjectDataUpdate } from '../../../../context/ProjectDataContext';
import { ProjectDataService } from '../../../../services/ProjectDataService';
import { generateId } from '../../../../utils/idGenerator';
import { TaskType, type SemanticValue } from '../../../../types/taskTypes';
import { LinkStyle, type EdgeData } from '../../types/flowTypes';
import { getDescendantNodeIds, translateNodes } from '../../../../flow/utils/graphTransforms';
import { variableCreationService } from '../../../../services/VariableCreationService';
import { useFlowCanvasId } from '../../context/FlowCanvasContext';
import { FLOW_GRAPH_MIGRATION, warnLocalGraphMutation } from '@domain/flowGraph';

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

  // ✅ MEASURE NODE HEIGHT: baseline for first paint (toolbar / layout)
  const nodeHeightRef = useRef<number | null>(null);
  /** Last width×height used to shift descendants when this node resizes (ResizeObserver). */
  const descendantShiftBaselineRef = useRef<{ width: number; height: number } | null>(null);

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

  const editingRowIdRef = useRef(editingRowId);
  editingRowIdRef.current = editingRowId;

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

  // ✅ NODE DRAG: Hook per accedere a React Flow per aggiornare posizione nodo
  const { getNode, setNodes, setEdges, getViewport, getEdges, updateNodeInternals } = useReactFlow();

  /** Fresh id/edges for ResizeObserver (avoid stale closure vs graph updates). */
  const descendantShiftNodeIdRef = useRef(id);
  descendantShiftNodeIdRef.current = id;
  const getEdgesForDescendantShiftRef = useRef(getEdges);
  getEdgesForDescendantShiftRef.current = getEdges;

  /**
   * When this node's DOM size changes, translate descendants by (Δw/2, Δh) so edges stay aligned
   * under the parent's horizontal center and bottom growth. Root position is unchanged.
   * Uses flushSync so child positions commit before the next paint (reduces flicker).
   */
  const applyDescendantShiftIfSizeChanged = useCallback(() => {
    const el = nodeContainerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const baseline = descendantShiftBaselineRef.current;

    if (baseline === null) {
      descendantShiftBaselineRef.current = { width: w, height: h };
      return;
    }

    const widthDelta = w - baseline.width;
    const heightDelta = h - baseline.height;

    if (Math.abs(widthDelta) <= 1 && Math.abs(heightDelta) <= 1) {
      descendantShiftBaselineRef.current = { width: w, height: h };
      return;
    }

    const ids = getDescendantNodeIds(
      descendantShiftNodeIdRef.current,
      getEdgesForDescendantShiftRef.current()
    );

    if (ids.size === 0) {
      descendantShiftBaselineRef.current = { width: w, height: h };
      return;
    }

    const dx = widthDelta / 2;
    const dy = heightDelta;

    flushSync(() => {
      setNodes((nds) => translateNodes(nds, ids, dx, dy));
    });

    descendantShiftBaselineRef.current = { width: w, height: h };
  }, [setNodes]);

  // ✅ ResizeObserver: sync callback (no rAF) + layout effect so updates align with paint
  useLayoutEffect(() => {
    const el = nodeContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      applyDescendantShiftIfSizeChanged();
    });
    ro.observe(el, { box: 'border-box' });
    applyDescendantShiftIfSizeChanged();
    return () => {
      ro.disconnect();
    };
  }, [applyDescendantShiftIfSizeChanged]);

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

  /** Remeasure intrinsic width (e.g. after row reorder). Ref used so useNodeDragDrop can call latest closure without reordering hooks. */
  const measureNodeWidthFromContentRef = useRef<() => void>(() => {});
  const measureNodeWidthFromContent = useCallback(() => {
    if (editingRowIdRef.current) {
      return;
    }
    const el = nodeContainerRef.current;
    if (!el) {
      return;
    }
    el.style.setProperty('min-width', '140px', 'important');
    el.style.setProperty('width', 'max-content', 'important');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (editingRowIdRef.current) {
          return;
        }
        const container = nodeContainerRef.current;
        if (!container) {
          return;
        }
        const w = Math.max(Math.ceil(container.getBoundingClientRect().width), 140);
        nodeWidthRef.current = w;
        setNodeWidth(w);
        container.style.setProperty('min-width', `${w}px`, 'important');
        container.style.setProperty('width', `${w}px`, 'important');
        container.style.setProperty('flex-shrink', '0', 'important');
        try {
          updateNodeInternals(id);
        } catch {
          /* RF may not be ready */
        }
      });
    });
  }, [id, updateNodeInternals]);
  measureNodeWidthFromContentRef.current = measureNodeWidthFromContent;

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

  /** Order of rows (ids) — length-only deps miss reorder; remeasure width after DnD so the box fits the widest label again. */
  const rowOrderSignature = useMemo(
    () => nodeRows.map((r) => r.id).join('|'),
    [nodeRows]
  );

  useLayoutEffect(() => {
    measureNodeWidthFromContent();
  }, [rowOrderSignature, editingRowId, measureNodeWidthFromContent]);

  useEffect(() => {
    const inner = rowsContainerRef.current;
    if (!inner) {
      return;
    }
    let raf: number | null = null;
    const schedule = () => {
      if (raf != null) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(() => {
        raf = null;
        if (!editingRowIdRef.current) {
          measureNodeWidthFromContentRef.current();
        }
      });
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(inner);
    return () => {
      if (raf != null) {
        cancelAnimationFrame(raf);
      }
      ro.disconnect();
    };
  }, [editingRowId, measureNodeWidthFromContent, rowsContainerRef]);

  // ✅ TOOLBAR: Ref per l'elemento toolbar (dichiarato prima dell'uso)
  const toolbarElementRef = useRef<HTMLDivElement>(null);

  // ✅ NODE DRAG: Ref per gestire il drag personalizzato del nodo
  const nodeDragStateRef = useRef<{
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
    isActive: boolean;
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
    nodeId: id,
    flowCanvasId: flowCanvasId,
    onSameNodeRowsReordered: () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          measureNodeWidthFromContentRef.current();
        });
      });
    },
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

    const variableRefId = row.meta?.variableRefId || generateId();
    const projectId = getCurrentProjectId();
    if (projectId) {
      // Ensure GUID->label mapping exists so ConditionEditor can show readable labels.
      const normalizedSlotLabel = variableCreationService.normalizeTaskLabel(
        (row.text || 'slot').trim() || 'slot'
      );
      variableCreationService.ensureManualVariableWithId(
        projectId,
        variableRefId,
        normalizedSlotLabel,
        { scope: 'flow', scopeFlowId: flowCanvasId }
      );
    }
    updateNodeRows((rows) =>
      rows.map((r) => (
        r.id === row.id
          ? { ...r, meta: { ...(r.meta || {}), variableRefId } }
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
      const conditionId = await createConditionForValue(categoryId, variableRefId, row.text || 'slot', valueLabel);
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
                type: TaskType.Subflow,
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
    };
    window.addEventListener(SEMANTIC_DRAFT_FLUSH_EVENT, onFlush as EventListener);
    return () => window.removeEventListener(SEMANTIC_DRAFT_FLUSH_EVENT, onFlush as EventListener);
  }, [nodeRows, normalizedData, setNodeRows]);

  // ✅ CROSS-NODE DRAG: merge row into this node when it is the drop target.
  // When the structural orchestrator already committed (`_state.handled`), props may still lag;
  // merge optimistically here and skip `onUpdate` to avoid double-writing the FlowStore.
  React.useEffect(() => {
    const handleCrossNodeMove = (event: CustomEvent) => {
      const detail = event.detail as {
        toNodeId?: string;
        rowData?: NodeRowData;
        mousePosition?: { x: number; y: number };
        _state?: { handled: boolean };
        targetRowInsertIndex?: number;
        targetRowId?: string | null;
        targetRegion?: 'portal' | 'row' | 'node';
      };
      const { toNodeId, rowData, mousePosition } = detail;

      if (toNodeId === id && import.meta.env.DEV) {
        console.log('DnD target:', { targetRegion: detail.targetRegion, targetRowId: detail.targetRowId });
      }

      if (toNodeId !== id || !rowData) {
        return;
      }

      const rowId = String(rowData.id || '').trim();
      if (!rowId) {
        return;
      }

      if (nodeRows.some((row) => row.id === rowId)) {
        return;
      }

      let targetIndex = nodeRows.length;
      const domIdx = detail.targetRowInsertIndex;
      if (typeof domIdx === 'number' && !Number.isNaN(domIdx)) {
        targetIndex = Math.max(0, Math.min(Math.floor(domIdx), nodeRows.length));
      } else if (mousePosition && rowsContainerRef.current) {
        const elements = Array.from(
          rowsContainerRef.current.querySelectorAll('.node-row-outer')
        ) as HTMLElement[];
        const rects = elements.map((el) => ({
          idx: Number(el.dataset.index),
          top: el.getBoundingClientRect().top,
          height: el.getBoundingClientRect().height,
        }));

        targetIndex = nodeRows.length;
        for (const r of rects) {
          if (mousePosition.y < r.top + r.height / 2) {
            targetIndex = r.idx;
            break;
          }
          targetIndex = r.idx + 1;
        }
      }

      const storeHandled = Boolean(detail._state?.handled);
      const skipOptimisticMerge =
        FLOW_GRAPH_MIGRATION.DISABLE_OPTIMISTIC_CROSS_NODE_MERGE && storeHandled;

      if (skipOptimisticMerge) {
        warnLocalGraphMutation('CustomNode:crossNodeRowMove skipped optimistic merge (flag)', {
          targetNodeId: id,
          rowId,
          storeHandled,
        });
      } else {
        const updatedRows = [...nodeRows];
        updatedRows.splice(targetIndex, 0, rowData);
        setNodeRows(updatedRows, { notifyParent: !storeHandled });
      }

      requestAnimationFrame(() => {
        const rowComponent = getRowComponent(rowId);
        if (rowComponent) {
          rowComponent.highlight();
        } else {
          requestAnimationFrame(() => {
            const rowComponentRetry = getRowComponent(rowId);
            if (rowComponentRetry) {
              rowComponentRetry.highlight();
            }
          });
        }
      });
    };

    window.addEventListener('crossNodeRowMove', handleCrossNodeMove as EventListener);
    return () => {
      window.removeEventListener('crossNodeRowMove', handleCrossNodeMove as EventListener);
    };
  }, [id, nodeRows, setNodeRows, rowsContainerRef, getRowComponent]);

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
        isVisible={(isHoveredNode || selected) && !isEditingNode && !normalizedData.hidden}
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
          if (!normalizedData.hidden) setIsHoveredNode(true);
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

              const isRigidDrag = FlowStateBridge.isRigidDrag();
              const rigidDescendantIds = isRigidDrag ? getDescendantNodeIds(id, getEdges()) : null;
              let lastRootPos = { x: currentNode.position.x, y: currentNode.position.y };

              nodeDragStateRef.current = {
                startX: nodeRect.left,
                startY: nodeRect.top,
                nodeStartX: currentNode.position.x,
                nodeStartY: currentNode.position.y,
                isActive: true,
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

                const newPosition = {
                  x: nodeDragStateRef.current.nodeStartX + flowDeltaX,
                  y: nodeDragStateRef.current.nodeStartY + flowDeltaY
                };

                const isRigidMove = FlowStateBridge.isRigidDrag();
                const incDx = newPosition.x - lastRootPos.x;
                const incDy = newPosition.y - lastRootPos.y;
                lastRootPos = { x: newPosition.x, y: newPosition.y };

                if (isRigidMove && rigidDescendantIds && rigidDescendantIds.size > 0 && (incDx !== 0 || incDy !== 0)) {
                  setNodes((nds) => {
                    const moved = translateNodes(nds, rigidDescendantIds, incDx, incDy);
                    return moved.map((n) => (n.id === id ? { ...n, position: newPosition } : n));
                  });
                } else {
                  setNodes((nds) =>
                    nds.map((n) => (n.id === id ? { ...n, position: newPosition } : n))
                  );
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
        style={{
          position: 'relative',
          display: 'inline-block',
          pointerEvents: normalizedData.hidden ? 'none' : undefined,
        }}
        onMouseEnter={() => {
          if (!normalizedData.hidden) setIsHoveredNode(true);
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
            if (!normalizedData.hidden) setIsHoveredNode(true);
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