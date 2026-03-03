import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EdgeProps } from 'reactflow';
import { createPortal } from 'react-dom';
import { useProjectDataUpdate, useProjectData } from '../../../context/ProjectDataContext';
import { ProjectDataService } from '../../../services/ProjectDataService';
import { useEdgeExecutionHighlight } from '../executionHighlight/useEdgeExecutionHighlight';
import { LinkStyle, DEFAULT_LINK_STYLE } from '../types/flowTypes';
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

  // ✅ EXECUTION HIGHLIGHT: Get execution highlight styles for edge
  const allEdges = typeof window !== 'undefined' ? (window as any).__flowEdges : [];
  const edgeHighlight = useEdgeExecutionHighlight(props as any, allEdges);

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

  // ✅ PULITO: Ref per onUpdate che è sempre disponibile
  const onUpdateRef = useRef<((updates: any) => void) | null>(null);

  // ✅ PULITO: Ref per pending position (evita flickering dopo salvataggio)
  const pendingLabelPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Get link style
  const linkStyle = (data as any)?.linkStyle ?? DEFAULT_LINK_STYLE;
  const label = props.data?.label || props.label;

  // Get saved label position from data (SVG coordinates)
  const savedLabelSvgPosition = (data as any)?.labelPositionSvg;

  // ✅ PULITO: Usa pending position se esiste, altrimenti saved position
  // Questo evita flickering quando la nuova posizione è stata salvata ma non è ancora in props.data
  const effectiveLabelSvgPosition = pendingLabelPositionRef.current || savedLabelSvgPosition;

  // ✅ PULITO: Quando savedLabelSvgPosition corrisponde a pending, resetta pending
  useEffect(() => {
    if (pendingLabelPositionRef.current && savedLabelSvgPosition) {
      const pending = pendingLabelPositionRef.current;
      const saved = savedLabelSvgPosition;
      // Confronta con tolleranza (1px)
      const distance = Math.sqrt(
        Math.pow(pending.x - saved.x, 2) + Math.pow(pending.y - saved.y, 2)
      );
      if (distance < 1) {
        pendingLabelPositionRef.current = null;
      }
    }
  }, [savedLabelSvgPosition]);

  // ✅ Use positioning hook (usa effectiveLabelSvgPosition per evitare flickering)
  const positions = useEdgePositioning(
    pathRef,
    sourceX,
    sourceY,
    effectiveLabelSvgPosition
  );

  // ✅ Use hover hook
  const hover = useEdgeHover({
    toolbarTransitionDelay: 200,
  });

  // ✅ Get control points from data with migration support
  const controlPointsRelative = useMemo((): ControlPointRelative[] => {
    const dataControlPoints = (data as any)?.controlPoints;
    if (!dataControlPoints || !Array.isArray(dataControlPoints) || dataControlPoints.length === 0) {
      return [];
    }

    // Check if we need to migrate legacy format
    const needsMigration = dataControlPoints.some(isLegacyControlPoint);

    if (needsMigration && pathRef.current) {
      // Migrate legacy points
      const legacyPoints = dataControlPoints.filter(isLegacyControlPoint);
      const migrated = migrateControlPoints(legacyPoints, pathRef.current);

      // If migration successful, save back to data
      if (migrated.length > 0 && props.data && typeof props.data.onUpdate === 'function') {
        // Migrate in background (don't block render)
        setTimeout(() => {
          props.data.onUpdate({
            data: {
              controlPoints: migrated,
            }
          });
        }, 0);
      }

      return migrated;
    }

    // Already in relative format
    return dataControlPoints.filter((cp: any): cp is ControlPointRelative =>
      typeof cp.t === 'number' && typeof cp.offset === 'number'
    );
  }, [data, pathRef, props.data]);

  // ✅ Control points drag hook
  const controlPointDrag = useControlPointDrag({
    controlPointsRelative,
    onControlPointsChange: useCallback((points: ControlPointRelative[]) => {
      if (props.data && typeof props.data.onUpdate === 'function') {
        props.data.onUpdate({
          data: {
            controlPoints: points,
          }
        });
      }
    }, [props.data]),
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

  // ✅ PULITO: Inizializza onUpdate immediatamente (sia da props che da window)
  useEffect(() => {
    // Se onUpdate è già disponibile in props.data, usalo
    if (props.data?.onUpdate && typeof props.data.onUpdate === 'function') {
      onUpdateRef.current = props.data.onUpdate;
      return;
    }

    // Altrimenti, crealo usando window.__createOnUpdate
    const createOnUpdate = (window as any).__createOnUpdate;
    if (typeof createOnUpdate === 'function') {
      const onUpdate = createOnUpdate(id);
      onUpdateRef.current = onUpdate;

      // Aggiorna anche l'edge con onUpdate per consistenza
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
      console.warn('[CustomEdge] createOnUpdate non disponibile su window per edge:', id);
    }
  }, [id, props.data?.onUpdate, reactFlowInstance]);

  // Label drag hook
  const handleLabelPositionChange = useCallback((newSvgPosition: { x: number; y: number }) => {
    // ✅ PULITO: Imposta pending position IMMEDIATAMENTE per evitare flickering
    pendingLabelPositionRef.current = newSvgPosition;

    // ✅ PULITO: Usa onUpdateRef che è sempre disponibile dopo l'inizializzazione
    if (onUpdateRef.current) {
      onUpdateRef.current({
        data: {
          labelPositionSvg: newSvgPosition,
        }
      });
      console.log('[CustomEdge] Posizione label salvata:', newSvgPosition);
    } else {
      // ✅ Fallback: prova a inizializzare onUpdate immediatamente
      const createOnUpdate = (window as any).__createOnUpdate;
      if (typeof createOnUpdate === 'function') {
        const onUpdate = createOnUpdate(id);
        onUpdateRef.current = onUpdate;
        onUpdate({
          data: {
            labelPositionSvg: newSvgPosition,
          }
        });
        console.log('[CustomEdge] onUpdate inizializzato al volo e posizione salvata:', newSvgPosition);
      } else {
        console.error('[CustomEdge] onUpdate non disponibile per edge:', id, '- la posizione non verrà salvata');
        // Se non possiamo salvare, resetta pending
        pendingLabelPositionRef.current = null;
      }
    }
  }, [id]);

  const labelDrag = useLabelDrag({
    labelRef: hoverRefs.labelRef,
    initialPosition: positions.labelScreenPosition,
    pathRef: pathRef,
    savedLabelSvgPosition: effectiveLabelSvgPosition,
    onPositionChange: handleLabelPositionChange,
    enabled: !!label,
    snapThreshold: 30,
    edgeId: id, // ✅ NUOVO: passa ID edge
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
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({
        label: item.description || item.name || '',
        actType: item.categoryType,
      });
    }
    setShowConditionIntellisense(false);
  };

  const handleUncondition = () => {
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({ label: undefined });
    }
  };

  const handleEditLabel = (newLabel: string) => {
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({ label: newLabel });
    }
  };

  const handleOpenConditionEditor = () => {
    try {
      const variables = (window as any).__omniaVars || {};
      const conditionName = String(label || 'Condition');
      let script = '';
      const conditions = (projectData as any)?.conditions || [];
      for (const cat of conditions) {
        for (const item of (cat.items || [])) {
          const itemName = item.name || item.label;
          if (itemName === conditionName) {
            script = (item as any)?.data?.script || '';
            break;
          }
        }
        if (script) break;
      }

      const ev: any = new CustomEvent('conditionEditor:open', {
        detail: {
          variables,
          script,
          label: conditionName,
          name: conditionName,
          nodeId: target,
          clickPosition: { x: 0, y: 0 },
        },
        bubbles: true,
      });
      document.dispatchEvent(ev);
    } catch {
      // Silent fail
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
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({
        data: {
          ...(props.data || {}),
          linkStyle: style,
        },
      });
    }
  }, [props.data]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleSelectCondition = (item: any) => {
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({
        label: item.description || item.name || '',
        data: { ...(props.data || {}), isElse: false },
      });
    }
    setShowConditionSelector(false);
  };

  const handleSelectUnconditioned = () => {
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({ label: undefined, data: { ...(props.data || {}), isElse: false } });
    }
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

      if (props.data && typeof props.data.onUpdate === 'function') {
        props.data.onUpdate({
          data: {
            controlPoints: updatedPoints,
          }
        });
      }
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
        style={style}
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
        hasConditionScript={(props.data as any)?.hasConditionScript}
        isElse={(props.data as any)?.isElse}
        onMouseEnter={() => hover.setLabelHovered(true)}
        onMouseLeave={() => hover.setLabelHovered(false)}
        toolbarRef={hoverRefs.toolbarRef}
        labelRef={hoverRefs.labelRef}
        dragPosition={labelDrag.dragPosition}
        isDragging={labelDrag.isDragging}
        onMouseDown={labelDrag.onMouseDown}
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
              if (props.data && typeof props.data.onUpdate === 'function') {
                const newData = { ...(props.data || {}), isElse: true };
                props.data.onUpdate({ label: 'Else', data: newData });
              }
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
