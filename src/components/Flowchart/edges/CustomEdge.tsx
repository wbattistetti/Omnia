import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EdgeProps, EdgeLabelRenderer } from 'reactflow';
import { createPortal } from 'react-dom';
import { useProjectDataUpdate, useProjectData } from '../../../context/ProjectDataContext';
import { ProjectDataService } from '../../../services/ProjectDataService';
import { useEdgeExecutionHighlight } from '../executionHighlight/useEdgeExecutionHighlight';
import { LinkStyle, DEFAULT_LINK_STYLE } from '../types/flowTypes';
import { useCompilationErrors } from '../../../context/CompilationErrorsContext';
import { useEdgeErrors } from '../hooks/useEdgeErrors';
import { IntellisenseMenu } from '../../Intellisense/IntellisenseMenu';
import { EdgeConditionSelector } from './EdgeConditionSelector';
import { useEdgePositioning } from './hooks/useEdgePositioning';
import { useEdgeHover, useEdgeHoverRefs } from './hooks/useEdgeHover';
import { EdgePathRenderer } from './components/EdgePathRenderer';
import { EdgeLabel } from './components/EdgeLabel';
import { EdgeControls } from './components/EdgeControls';
import { EdgeControlPoints } from './components/EdgeControlPoints';
import { EdgeContextMenu } from './components/EdgeContextMenu';
import { useLabelDrag } from './hooks/useLabelDrag';
import { useControlPointDrag } from './hooks/useControlPointDrag';
import { ControlPointRelative } from './types/edgeTypes';
import { isLegacyControlPoint, migrateControlPoints } from './utils/dataMigration';
import { useReactFlow } from 'reactflow';
import { CoordinateConverter } from './utils/coordinateUtils';
import { FlowStateBridge } from '../../../services/FlowStateBridge';
import { useFlowCanvasId } from '../context/FlowCanvasContext';
import { useFlowActions } from '../../../context/FlowActionsContext';
import { getPathSegments, PathSegment } from './utils/pathUtils';
import { computeAbsoluteFromRelative } from './utils/labelPositionUtils';

export type CustomEdgeProps = EdgeProps & {
  onDeleteEdge?: (edgeId: string) => void;
};

export const CustomEdge: React.FC<CustomEdgeProps> = (props) => {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    onDeleteEdge,
    data,
  } = props;

  const reactFlowInstance = useReactFlow();
  const flowCanvasId = useFlowCanvasId();

  // Execution highlight styles
  const allEdges = reactFlowInstance.getEdges() as any[];
  const edgeHighlight = useEdgeExecutionHighlight(props as any, allEdges);

  // ✅ COMPILATION ERRORS: Get errors for this edge
  const { errors: compilationErrors } = useCompilationErrors();
  const edgeErrors = useEdgeErrors(id, compilationErrors);

  const { addItem, addCategory } = useProjectDataUpdate();
  // ✅ FASE 1: Read only from window.__projectData (not React state)

  // State for condition selector and intellisense
  const [showConditionIntellisense, setShowConditionIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });
  const [showConditionSelector, setShowConditionSelector] = useState(false);
  const [conditionSelectorPos, setConditionSelectorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // State for context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  /** Matita su link senza label → textbox inline (EdgeLabel) */
  const [openEmptyLabelEditor, setOpenEmptyLabelEditor] = useState(false);

  // Refs
  const pathRef = useRef<SVGPathElement>(null);
  const hoverRefs = useEdgeHoverRefs();

  // Context for edge operations (with fallback to legacy)
  const flowActions = useFlowActions();
  const onUpdateRef = useRef<((updates: any) => void) | null>(null);

  // Stable update function that uses context or fallback
  const updateEdgeData = useCallback((updates: any) => {
    // Priority 1: Use context if available
    if (flowActions?.updateEdge) {
      flowActions.updateEdge(id, updates.data || updates);
      return true;
    }
    // Priority 2: Use onUpdateRef (legacy)
    if (onUpdateRef.current) {
      onUpdateRef.current(updates);
      return true;
    }
    // Priority 3: Try to initialize from FlowStateBridge
    const createOnUpdate = FlowStateBridge.getCreateOnUpdate();
    if (typeof createOnUpdate === 'function') {
      const onUpdate = createOnUpdate(id);
      onUpdateRef.current = onUpdate;
      onUpdate(updates);
      return true;
    }
    return false;
  }, [id, flowActions]);

  // ✅ Get persistent fields from top-level (NOT from data)
  const linkStyle = (props as any).linkStyle ?? (data as any)?.linkStyle ?? DEFAULT_LINK_STYLE;
  const label = props.label || props.data?.label;

  // ✅ ARCHITECTURE PRINCIPLE #1: Single source of truth - ONLY labelPositionRelative is persisted
  // labelPositionAbsolute is ALWAYS computed by useLabelPosition (never saved)
  const labelPositionRelative = ((props as any).labelPositionRelative ?? (data as any)?.labelPositionRelative) || null;

  // ✅ Debug: Log when labelPositionRelative changes in props
  useEffect(() => {
    console.log('[CustomEdge] 🔄 labelPositionRelative changed in props:', {
      edgeId: id,
      labelPositionRelative,
      fromProps: (props as any).labelPositionRelative,
      fromData: (data as any)?.labelPositionRelative,
      propsKeys: Object.keys(props),
      dataKeys: data ? Object.keys(data) : [],
    });
  }, [id, labelPositionRelative, props, data]);

  // ✅ ZERO-LAG ARCHITECTURE: Calculate directly during render, no hooks, no effects
  // This eliminates all lag because calculation happens in same render cycle as path update
  // Path is already updated by ReactFlow → we calculate {x, y} immediately → same frame
  const labelPositionAbsolute = computeAbsoluteFromRelative(
    pathRef,
    labelPositionRelative
  );

  // ✅ Calculate labelSvgPosition directly (no useEdgePositioning for label)
  // This eliminates the useState/useEffect lag in useEdgePositioning
  const labelSvgPosition = labelPositionAbsolute || (() => {
    // Fallback to midpoint if no relative position
    if (linkStyle === LinkStyle.VHV) {
      // For VHV place label at the midpoint of the last vertical segment (near target).
      const midY = (sourceY + targetY) / 2;
      return { x: targetX, y: (midY + targetY) / 2 };
    }
    if (!pathRef.current) return { x: 0, y: 0 };
    const path = pathRef.current;
    const pathLength = path.getTotalLength();
    if (pathLength === 0) return { x: 0, y: 0 };
    const midPoint = path.getPointAtLength(pathLength / 2);
    return { x: midPoint.x, y: midPoint.y };
  })();

  // ✅ Use positioning hook ONLY for EdgeControls (midPoint, sourceScreen)
  // NOT for label position (which is calculated directly above)
  const positions = useEdgePositioning(
    pathRef,
    sourceX,
    sourceY,
    targetX,
    targetY,
    null // ✅ Don't pass labelPositionAbsolute - we calculate it directly above
  );

  // ✅ Use hover hook
  const hover = useEdgeHover({
    toolbarTransitionDelay: 200,
  });

  // ✅ FIX: useEffect invece di useMemo - pathRef.current è null durante il render
  // useEffect gira DOPO il render → pathRef.current è già popolato ✅
  const [edgeSegments, setEdgeSegments] = useState<PathSegment[]>([]);

  const computeEdgeSegments = useCallback(() => {
    if (!pathRef.current) {
      setEdgeSegments([]);
      return;
    }

    try {
      const pathLength = pathRef.current.getTotalLength();
      if (pathLength === 0) {
        setEdgeSegments([]);
        return;
      }

      setEdgeSegments(getPathSegments(pathRef.current));
    } catch (e) {
      console.warn('[CustomEdge] Failed to compute edge segments:', e);
      setEdgeSegments([]);
    }
  }, []); // pathRef è stabile, non serve nelle deps

  // ✅ Aggiorna quando cambia il path (nodi spostati, path modificato)
  useEffect(() => {
    computeEdgeSegments();
  }, [sourceX, sourceY, targetX, targetY, computeEdgeSegments]);

  // ✅ Aggiorna anche quando il path DOM cambia (MutationObserver fallback)
  useEffect(() => {
    if (!pathRef.current) return;

    const observer = new MutationObserver(() => {
      computeEdgeSegments();
    });

    observer.observe(pathRef.current, {
      attributes: true,
      attributeFilter: ['d'],
      subtree: false,
    });

    // Check iniziale
    computeEdgeSegments();

    return () => {
      observer.disconnect();
    };
  }, [computeEdgeSegments]);

  // ✅ Get control points from top-level with migration support
  const controlPointsRelative = useMemo((): ControlPointRelative[] => {
    const dataControlPoints = (props as any).controlPoints ?? (data as any)?.controlPoints;
    if (!dataControlPoints || !Array.isArray(dataControlPoints) || dataControlPoints.length === 0) {
      return [];
    }

    // Check if we need to migrate legacy format
    const needsMigration = dataControlPoints.some(isLegacyControlPoint);

    if (needsMigration && pathRef.current) {
      // Migrate legacy points
      const legacyPoints = dataControlPoints.filter(isLegacyControlPoint);
      const migrated = migrateControlPoints(legacyPoints, pathRef.current);

      // If migration successful, save back to top-level
      if (migrated.length > 0) {
        // Migrate in background (don't block render)
        setTimeout(() => {
          updateEdgeData({
            controlPoints: migrated,  // ✅ Top-level
          });
        }, 0);
      }

      return migrated;
    }

    // Already in relative format
    return dataControlPoints.filter((cp: any): cp is ControlPointRelative =>
      typeof cp.t === 'number' && typeof cp.offset === 'number'
    );
  }, [(props as any).controlPoints, (data as any)?.controlPoints, pathRef]);

  // Control points drag hook
  const controlPointDrag = useControlPointDrag({
    controlPointsRelative,
    onControlPointsChange: useCallback((points: ControlPointRelative[]) => {
      updateEdgeData({
        controlPoints: points,  // ✅ Top-level
      });
    }, [updateEdgeData]),
    pathRef,
    enableSnapping: false,
    snapDistance: 10,
  });

  // ✅ Convert control points to absolute for EdgePathRenderer
  // CRITICO: Aggiorna quando cambiano i nodi (sourceX/sourceY/targetX/targetY)
  // perché il path cambia e i control points relativi devono essere riconvertiti
  const controlPointsAbsolute = useMemo(() => {
    if (!pathRef.current || controlPointsRelative.length === 0) return undefined;

    const converter = new CoordinateConverter(reactFlowInstance, pathRef);
    return controlPointsRelative
      .map((rel) => {
        const abs = converter.relativeToAbsolute(rel);
        return abs ? { x: abs.x, y: abs.y } : null;
      })
      .filter((p): p is { x: number; y: number } => p !== null);
  }, [controlPointsRelative, pathRef, reactFlowInstance, sourceX, sourceY, targetX, targetY]);

  // Initialize onUpdate immediately (from props or via FlowStateBridge)
  useEffect(() => {
    // If onUpdate is already available in props.data, use it
    if (props.data?.onUpdate && typeof props.data.onUpdate === 'function') {
      onUpdateRef.current = props.data.onUpdate;
      return;
    }

    // Otherwise, create it using FlowStateBridge
    const createOnUpdate = FlowStateBridge.getCreateOnUpdate();
    if (typeof createOnUpdate === 'function') {
      const onUpdate = createOnUpdate(id);
      onUpdateRef.current = onUpdate;

      // Also update the edge with onUpdate for consistency
      reactFlowInstance.setEdges((eds) =>
        eds.map((e) =>
          e.id === id && !e.data?.onUpdate
            ? {
              ...e,
              data: {
                ...(e.data || {}),
                onUpdate,
              },
            }
            : e
        )
      );
      console.log('[CustomEdge] onUpdate inizializzato per edge:', id);
    } else {
      console.warn('[CustomEdge] createOnUpdate non disponibile per edge:', id);
    }
  }, [id, props.data?.onUpdate, reactFlowInstance]);

  // ✅ ARCHITECTURE PRINCIPLE #3: Single point that writes position
  // This is the ONLY place that saves labelPositionRelative
  const handleLabelPositionChange = useCallback((labelPositionRelative: { t: number; offset: number }) => {
    console.log('[CustomEdge] 📍 handleLabelPositionChange - called with:', {
      edgeId: id,
      labelPositionRelative,
    });

    // ✅ ARCHITECTURE FIX: Use ONLY updateEdgeData (which calls flowActions.updateEdge)
    // This ensures ReactFlow edges props are updated correctly via setEdgesRef.current
    // Remove FlowStateBridge.setEdges duplication - updateEdgeData handles it
    updateEdgeData({
      labelPositionRelative,
    });
    console.log('[CustomEdge] ✅ updateEdgeData called with labelPositionRelative:', labelPositionRelative);
  }, [id, updateEdgeData]);

  // ✅ NEW MODEL: Simplified label drag hook with discrete hit-area model
  const labelDrag = useLabelDrag({
    labelRef: hoverRefs.labelRef,
    pathRef: pathRef,
    segments: edgeSegments, // ✅ Segments for THIS edge only
    onPositionChange: handleLabelPositionChange,
    enabled: !!label,
  });

  // ✅ NEW MODEL: Determine if this edge should show highlight
  const shouldShowHighlight = labelDrag.highlightedEdgeId === id && labelDrag.highlightedSegment;

  // Handlers
  const handleOpenIntellisense = (x: number, y: number) => {
    setIntellisensePosition({ x, y });
    setShowConditionIntellisense(true);
  };

  const handleCloseIntellisense = () => setShowConditionIntellisense(false);

  const handleIntellisenseSelect = (item: any) => {
    updateEdgeData({
      label: item.description || item.name || '',
      actType: item.categoryType,
    });
    setShowConditionIntellisense(false);
  };

  const handleUncondition = () => {
    updateEdgeData({ label: undefined });
  };

  const handleEditLabel = (newLabel: string) => {
    updateEdgeData({ label: newLabel });
  };

  /**
   * Opens the Condition Editor for this edge.
   * Only dispatches the event - generation happens in ConditionEditorEventHandler
   * where complete variables are available.
   */
  const handleOpenConditionEditor = () => {
    try {
      const conditionName = String(label || 'Condition');

      // ✅ Check if edge already has conditionId (top-level)
      const currentEdges = reactFlowInstance.getEdges() as any[];
      const currentEdge = currentEdges.find((e: any) => e.id === id);
      const existingConditionId = currentEdge?.conditionId || (props as any).conditionId;  // ✅ Top-level

      console.log('[CustomEdge] 🔍 [TRACE] Opening condition editor', {
        timestamp: new Date().toISOString(),
        edgeId: id,
        label: conditionName,
        conditionIdFromProps: (props as any).conditionId,  // ✅ Top-level
        conditionIdFromBridge: currentEdge?.conditionId,  // ✅ Top-level
        existingConditionId,
        hasCurrentEdge: !!currentEdge,
        allEdgesCount: currentEdges.length,
        edgesWithConditionId: currentEdges.filter((e: any) => e.conditionId).map((e: any) => ({
          id: e.id,
          conditionId: e.conditionId
        }))
      });

      // ✅ FASE 2: Read condition from window.__projectData
      // readableCode will be generated by loadScriptById in ConditionEditor
      // We don't need to convert here - ConditionEditor will handle it
      let foundConditionId: string | undefined = undefined;

      if (existingConditionId) {
        // ✅ Verify condition exists in window.__projectData
        const projectData = (window as any).__projectData;
        const conditions = projectData?.conditions || [];
        const allConditionIds: string[] = [];
        for (const cat of conditions) {
          for (const item of (cat.items || [])) {
            const itemId = item.id || item._id;
            allConditionIds.push(itemId);
            if (itemId === existingConditionId) {
              foundConditionId = itemId;
              const hasExecutableCode = !!(item as any).expression?.executableCode;
              const hasCompiledCode = !!(item as any).expression?.compiledCode;
              console.log('[CustomEdge] ✅ [TRACE] Condition found in projectData', {
                conditionId: itemId,
                name: item.name || item.label,
                hasExecutableCode,
                hasCompiledCode,
                executableCodeLength: (item as any).expression?.executableCode?.length || 0
              });
              break;
            }
          }
          if (foundConditionId) break;
        }

        // ✅ If conditionId exists but condition not found, notify error
        if (!foundConditionId) {
          console.error('[CustomEdge] ❌ [TRACE] Condition not found in projectData', {
            edgeId: id,
            conditionId: existingConditionId,
            edgeLabel: label,
            allConditionIds,
            conditionsCount: conditions.length,
            totalItemsCount: conditions.reduce((sum: number, cat: any) => sum + (cat.items || []).length, 0)
          });
        }
      } else {
        console.log('[CustomEdge] ℹ️ [TRACE] No existing conditionId on edge - will create new condition', {
          edgeId: id,
          label: conditionName
        });
      }
      // ✅ If no conditionId, condition doesn't exist yet (no search by label)

      const finalConditionId = foundConditionId || existingConditionId;
      console.log('[CustomEdge] 📤 [TRACE] Dispatching conditionEditor:open event', {
        edgeId: id,
        label: conditionName,
        nodeId: target,
        conditionId: finalConditionId,
        willCreateNew: !finalConditionId
      });

      // ✅ FASE 2: Simplified event - readableCode will be generated by ConditionEditor.loadScriptById
      const ev = new CustomEvent('conditionEditor:open', {
        detail: {
          label: conditionName,
          name: conditionName,
          nodeId: target,
          edgeId: id, // ✅ Edge ID
          conditionId: finalConditionId, // ✅ Condition ID (if exists)
          readableCode: '', // ✅ Will be generated by ConditionEditor.loadScriptById
          flowId: flowCanvasId,
        },
        bubbles: true,
      });
      document.dispatchEvent(ev);
    } catch (e) {
      console.error('[CustomEdge] ❌ [TRACE] Failed to open condition editor', e);
    }
  };

  const handleDelete = (edgeId: string) => {
    if (data && typeof data.onDeleteEdge === 'function') {
      data.onDeleteEdge(edgeId);
    } else if (onDeleteEdge) {
      onDeleteEdge(edgeId);
    }
  };

  const handlePencilClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenEmptyLabelEditor(true);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleSelectLinkStyle = useCallback((style: LinkStyle) => {
    updateEdgeData({
      linkStyle: style,  // ✅ Top-level
    });
  }, [updateEdgeData]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleSelectCondition = (item: any) => {
    updateEdgeData({
      label: item.description || item.name || '',
      isElse: false,  // ✅ Top-level
    });
    setShowConditionSelector(false);
  };

  const handleSelectUnconditioned = () => {
    updateEdgeData({
      label: undefined,
      isElse: false  // ✅ Top-level
    });
    setShowConditionSelector(false);
  };

  const handleCloseSelector = () => {
    setShowConditionSelector(false);
  };

  const handleCreateCondition = async (name: string) => {
    try {
      const conditions = (projectData as any)?.conditions || [];
      let categoryId = '';

      if (conditions.length > 0) {
        categoryId = conditions[0].id;
      } else {
        await addCategory('conditions', 'Default Conditions');
        const updatedData = await ProjectDataService.loadProjectData();
        const updatedConditions = (updatedData as any)?.conditions || [];
        categoryId = updatedConditions[0]?.id || '';
      }

      if (categoryId) {
        try {
          (await import('../../../ui/events')).emitSidebarOpenAccordion('conditions');
        } catch {
          // Silent fail
        }

        await addItem('conditions', categoryId, name, '');

        setTimeout(async () => {
          try {
            (await import('../../../ui/events')).emitSidebarHighlightItem('conditions', name);
          } catch {
            // Silent fail
          }
        }, 100);

        setTimeout(async () => {
          const variables = (window as any).__omniaVars || {};
          try {
            (await import('../../../ui/events')).emitConditionEditorOpen({
              variables,
              script: '',
              label: name,
              name,
            });
          } catch {
            // Silent fail
          }
        }, 200);

        setShowConditionSelector(false);
      }
    } catch (error) {
      console.error('Errore nella creazione della condizione:', error);
    }
  };

  // ✅ Add new control point on Shift+Click
  const handleShiftClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!pathRef.current) return;

    const converter = new CoordinateConverter(reactFlowInstance, pathRef);
    const clickScreen = { x: e.clientX, y: e.clientY };
    const clickSvg = converter.screenToSvg(clickScreen);
    if (!clickSvg) return;

    const path = pathRef.current;
    const pathLength = path.getTotalLength();
    if (pathLength === 0) return;

    // Find closest point on path
    let minDistance = Infinity;
    let bestT = 0.5;

    const samples = 100;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = path.getPointAtLength(pathLength * t);
      const dist = Math.sqrt(
        Math.pow(clickSvg.x - point.x, 2) + Math.pow(clickSvg.y - point.y, 2)
      );
      if (dist < minDistance) {
        minDistance = dist;
        bestT = t;
      }
    }

    // Check if too close to existing points
    const converterForCheck = new CoordinateConverter(reactFlowInstance, pathRef);
    const tooClose = controlPointsRelative.some((rel) => {
      const abs = converterForCheck.relativeToAbsolute(rel);
      if (!abs) return false;
      const dist = Math.sqrt(
        Math.pow(clickSvg.x - abs.x, 2) + Math.pow(clickSvg.y - abs.y, 2)
      );
      return dist < 20; // 20px threshold
    });

    if (!tooClose && minDistance < 50) {
      // Add new control point in relative format
      const newPoint: ControlPointRelative = {
        t: bestT,
        offset: 0, // On path initially
      };

      const updatedPoints = [...controlPointsRelative, newPoint].sort((a, b) => a.t - b.t);

      updateEdgeData({
        controlPoints: updatedPoints,  // ✅ Top-level
      });
    }
  };

  return (
    <>
      <EdgePathRenderer
        ref={pathRef}
        id={id}
        sourceX={sourceX}
        sourceY={sourceY}
        targetX={targetX}
        targetY={targetY}
        sourcePosition={sourcePosition}
        targetPosition={targetPosition}
        linkStyle={linkStyle}
        controlPoints={controlPointsAbsolute}
        style={{
          ...style,
          // ✅ Priority: Error stroke > Execution highlight > Default
          stroke: edgeErrors.strokeColor !== 'transparent'
            ? edgeErrors.strokeColor
            : edgeHighlight.stroke || (style as any)?.stroke,
          strokeWidth: edgeErrors.strokeWidth !== 2
            ? edgeErrors.strokeWidth
            : edgeHighlight.strokeWidth || (style as any)?.strokeWidth || 2,
        }}
        markerEnd={markerEnd}
        hovered={hover.state.hovered}
        selected={props.selected}
        executionHighlight={edgeHighlight}
        trashHovered={hover.state.trashHovered}
        onShiftClick={handleShiftClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => hover.setHovered(true)}
        onMouseLeave={() => hover.setHovered(false)}
        highlightedSegment={shouldShowHighlight ? labelDrag.highlightedSegment : null}
        // ✅ NEW MODEL: Hit-areas integrate nell'SVG
        hitAreaSegments={labelDrag.isDragging ? edgeSegments : []}
        hitAreaWidth={25}
        onSegmentEnter={labelDrag.onSegmentEnter}
        onSegmentLeave={labelDrag.onSegmentLeave}
        isDragging={labelDrag.isDragging}
      />

      <EdgeControls
        showPencil={!label && (props.selected || hover.state.hovered)}
        showTrash={props.selected || hover.state.hovered}
        midPointSvg={positions.midPointSvg}
        sourceX={sourceX}
        sourceY={sourceY}
        sourcePosition={sourcePosition}
        onPencilClick={handlePencilClick}
        onTrashClick={(e) => {
          e.stopPropagation();
          handleDelete(id);
        }}
        onTrashMouseEnter={() => hover.setTrashHovered(true)}
        onTrashMouseLeave={() => hover.setTrashHovered(false)}
        trashHovered={hover.state.trashHovered}
        onControlsZoneMouseEnter={() => hover.setHovered(true)}
        onControlsZoneMouseLeave={() => hover.setHovered(false)}
      />

      {/* Control Points */}
      {(hover.state.hovered || props.selected) && (
        <EdgeControlPoints
          controlPointsAbsolute={controlPointDrag.controlPointsAbsolute}
          draggingPointId={controlPointDrag.draggingPointId}
          onMouseDown={controlPointDrag.onMouseDown}
          onMouseUp={controlPointDrag.onMouseUp}
          pathRef={pathRef}
          hovered={hover.state.hovered}
          selected={props.selected}
          showDistance={10}
        />
      )}

      {/* ✅ REFACTOR: Usa EdgeLabelRenderer per gestire automaticamente le trasformazioni SVG */}
      <EdgeLabelRenderer>
        <EdgeLabel
          label={label}
          position={labelSvgPosition} // ✅ Direct calculation, no useEdgePositioning
          isHovered={hover.state.labelHovered}
          onEdit={handleEditLabel}
          onUncondition={handleUncondition}
          onOpenConditionEditor={handleOpenConditionEditor}
          hasConditionScript={!!((props as any).conditionId || (props.data as any)?.hasConditionScript)}
          isElse={(props as any).isElse ?? (props.data as any)?.isElse}
          onMouseEnter={() => hover.setLabelHovered(true)}
          onMouseLeave={() => hover.setLabelHovered(false)}
          toolbarRef={hoverRefs.toolbarRef}
          labelRef={hoverRefs.labelRef}
          dragPosition={labelDrag.dragPosition}
          isDragging={labelDrag.isDragging}
          onMouseDown={labelDrag.onMouseDown}
          edgeId={id} // ✅ Add edgeId prop
          allowEmptyRender={openEmptyLabelEditor}
          onEmptyLabelEditFinished={() => setOpenEmptyLabelEditor(false)}
        />
      </EdgeLabelRenderer>

      {/* Intellisense Menu */}
      {showConditionIntellisense &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              left: intellisensePosition.x,
              top: intellisensePosition.y,
              zIndex: 9999,
            }}
          >
            <IntellisenseMenu
              isOpen={showConditionIntellisense}
              query={typeof props.label === 'string' ? props.label : ''}
              position={{ x: 0, y: 0 }}
              referenceElement={null}
              onSelect={handleIntellisenseSelect}
              onClose={handleCloseIntellisense}
              filterCategoryTypes={['conditions']}
            />
          </div>,
          document.body
        )}

      {/* Edge Condition Selector */}
      {showConditionSelector &&
        createPortal(
          <EdgeConditionSelector
            position={conditionSelectorPos}
            onSelectCondition={handleSelectCondition}
            onSelectUnconditioned={handleSelectUnconditioned}
            onSelectElse={() => {
              updateEdgeData({
                label: 'Else',
                isElse: true  // ✅ Top-level
              });
              setShowConditionSelector(false);
            }}
            onClose={handleCloseSelector}
            onCreateCondition={handleCreateCondition}
          />,
          document.body
        )}

      {/* Edge Context Menu */}
      {contextMenu && (
        <EdgeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          currentLinkStyle={linkStyle}
          onSelectStyle={handleSelectLinkStyle}
          onClose={handleCloseContextMenu}
        />
      )}
    </>
  );
};

export default CustomEdge;
