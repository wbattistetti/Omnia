import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EdgeProps } from 'reactflow';
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
import { useFlowActions } from '../../../context/FlowActionsContext';

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

  // Execution highlight styles
  const allEdges = FlowStateBridge.getEdges();
  const edgeHighlight = useEdgeExecutionHighlight(props as any, allEdges);

  // ✅ COMPILATION ERRORS: Get errors for this edge
  const { errors: compilationErrors } = useCompilationErrors();
  const edgeErrors = useEdgeErrors(id, compilationErrors);

  const { addItem, addCategory } = useProjectDataUpdate();
  const { data: projectData } = useProjectData();

  // State for condition selector and intellisense
  const [showConditionIntellisense, setShowConditionIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });
  const [showConditionSelector, setShowConditionSelector] = useState(false);
  const [conditionSelectorPos, setConditionSelectorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // State for context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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

  // ✅ PULITO: Get saved label position in relative format (t, offset) - top-level
  const labelPositionRelative = ((props as any).labelPositionRelative ?? (data as any)?.labelPositionRelative) || null;

  // Auto-migration from legacy labelPositionSvg
  useEffect(() => {
    // Skip if already have relative position
    if (labelPositionRelative) return;

    // If we have legacy labelPositionSvg and path is available, migrate
    const legacySvg = (props as any).labelPositionSvg ?? (data as any)?.labelPositionSvg;
    if (legacySvg && pathRef.current) {
      const converter = new CoordinateConverter(reactFlowInstance, pathRef);
      const migrated = converter.labelAbsoluteToRelative(legacySvg);
      if (migrated) {
        updateEdgeData({
          labelPositionRelative: migrated,  // ✅ Top-level
          labelPositionSvg: undefined,  // ✅ Top-level
        });
        console.log('[CustomEdge] Migrazione labelPositionSvg → labelPositionRelative:', migrated);
      }
    }
  }, [labelPositionRelative, (props as any).labelPositionSvg, (data as any)?.labelPositionSvg, reactFlowInstance]);

  // ✅ PULITO: Use positioning hook con labelPositionRelative
  const positions = useEdgePositioning(
    pathRef,
    sourceX,
    sourceY,
    labelPositionRelative
  );

  // ✅ Use hover hook
  const hover = useEdgeHover({
    toolbarTransitionDelay: 200,
  });

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

  // Label drag hook - saves labelPositionRelative
  const handleLabelPositionChange = useCallback((newRelative: { t: number; offset: number }) => {
    const success = updateEdgeData({
      labelPositionRelative: newRelative,  // ✅ Top-level
      labelPositionSvg: undefined, // Remove legacy if exists (top-level)
    });
    if (success) {
      console.log('[CustomEdge] Label position saved (relative):', newRelative);
    } else {
      console.error('[CustomEdge] Failed to save label position for edge:', id);
    }
  }, [id, updateEdgeData]);

  const labelDrag = useLabelDrag({
    labelRef: hoverRefs.labelRef,
    initialPosition: positions.labelScreenPosition,
    pathRef: pathRef,
    savedLabelSvgPosition: null, // ✅ LEGACY: non più usato, solo per compatibilità
    onPositionChange: handleLabelPositionChange,
    enabled: !!label,
    snapThreshold: 30,
    edgeId: id,
  });

  // ✅ NUOVO: Determina se questo edge deve mostrare highlight
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
      const currentEdges = FlowStateBridge.getEdges();
      const currentEdge = currentEdges.find((e: any) => e.id === id);
      const existingConditionId = currentEdge?.conditionId || (props as any).conditionId;  // ✅ Top-level

      console.log('[CustomEdge] 🔍 Opening condition editor', {
        edgeId: id,
        label: conditionName,
        conditionIdFromProps: (props as any).conditionId,  // ✅ Top-level
        conditionIdFromBridge: currentEdge?.conditionId,  // ✅ Top-level
        existingConditionId,
        hasCurrentEdge: !!currentEdge
      });

      // ✅ Search for existing condition script ONLY if conditionId exists
      let existingScript = '';
      let foundConditionId: string | undefined = undefined;

      if (existingConditionId) {
        // ✅ Search by ID (edge is already linked to a condition)
        const conditions = (projectData as any)?.conditions || [];
        for (const cat of conditions) {
          for (const item of (cat.items || [])) {
            const itemId = item.id || item._id;
            if (itemId === existingConditionId) {
              // Load DSL (uiCode) - source of truth
              existingScript = (item as any)?.data?.uiCode || (item as any)?.data?.script || '';
              foundConditionId = itemId;
              break;
            }
          }
          if (foundConditionId) break;
        }

        // ✅ If conditionId exists but condition not found, notify error
        if (!foundConditionId) {
          console.error('[CustomEdge] ⚠️ Condition not found', {
            edgeId: id,
            conditionId: existingConditionId,
            edgeLabel: label
          });
          // TODO: Show user notification (toast/message)
        }
      }
      // ✅ If no conditionId, don't search by label - condition doesn't exist yet

      // Dispatch event - generation will happen in ConditionEditorEventHandler
      const ev = new CustomEvent('conditionEditor:open', {
        detail: {
          label: conditionName,
          name: conditionName,
          script: existingScript,
          nodeId: target,
          needsGeneration: !existingConditionId || !existingScript || !existingScript.trim(),
          edgeId: id, // ✅ Edge ID
          conditionId: foundConditionId || existingConditionId, // ✅ Condition ID (if exists)
        },
        bubbles: true,
      });
      document.dispatchEvent(ev);
    } catch (e) {
      console.error('[CustomEdge] Failed to open condition editor', e);
    }
  };

  const handleDelete = (edgeId: string) => {
    if (data && typeof data.onDeleteEdge === 'function') {
      data.onDeleteEdge(edgeId);
    } else if (onDeleteEdge) {
      onDeleteEdge(edgeId);
    }
  };

  const handleGearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    handleOpenIntellisense(rect.left + window.scrollX, rect.bottom + window.scrollY + 2);
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
      />

      <EdgeControls
        showGear={!label && props.selected}
        showTrash={props.selected}
        midPointSvg={positions.midPointSvg}
        sourceX={sourceX}
        sourceY={sourceY}
        sourcePosition={sourcePosition}
        onGearClick={handleGearClick}
        onTrashClick={(e) => {
          e.stopPropagation();
          handleDelete(id);
        }}
        onTrashMouseEnter={() => hover.setTrashHovered(true)}
        onTrashMouseLeave={() => hover.setTrashHovered(false)}
        trashHovered={hover.state.trashHovered}
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

      <EdgeLabel
        label={label}
        position={positions.labelScreenPosition}
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
      />

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
