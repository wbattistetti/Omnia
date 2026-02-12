import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { ControlPoint } from './hooks/useControlPointDrag';
import { extractPathVertices } from './utils/pathUtils';
import { useLabelDrag } from './hooks/useLabelDrag';

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

  // Refs
  const pathRef = useRef<SVGPathElement>(null);
  const hoverRefs = useEdgeHoverRefs();

  // Get link style
  const linkStyle = (data as any)?.linkStyle ?? DEFAULT_LINK_STYLE;
  const label = props.data?.label || props.label;

  // Get saved label position from data (now in SVG coordinates)
  const savedLabelSvgPosition = (data as any)?.labelPositionSvg;

  // Debug: log only when position changes
  useEffect(() => {
    if (savedLabelSvgPosition) {
      console.log('Reading saved label position:', savedLabelSvgPosition);
    }
  }, [savedLabelSvgPosition?.x, savedLabelSvgPosition?.y]);

  // ✅ Use positioning hook (eliminates polling)
  // Note: pathRef will be populated by EdgePathRenderer after first render
  const positions = useEdgePositioning(
    pathRef,
    '', // edgePath is calculated in EdgePathRenderer
    sourceX,
    sourceY,
    sourcePosition,
    savedLabelSvgPosition
  );

  // ✅ Use hover hook (stable toolbar)
  const hover = useEdgeHover({
    toolbarTransitionDelay: 200,
  });

  // Calculate edge path for positioning (needed for midpoint calculation)
  // This is a simplified version - actual path is calculated in EdgePathRenderer
  const getEdgePathString = () => {
    // We need to calculate a temporary path to get the midpoint
    // This is used only for positioning calculations
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;
    return `M ${sourceX},${sourceY} L ${midX},${midY} L ${targetX},${targetY}`;
  };

  // Update pathRef when path changes (for positioning hook)
  useEffect(() => {
    if (pathRef.current) {
      // Path will be updated by EdgePathRenderer
      // This effect ensures positioning hook can access the path
    }
  }, [sourceX, sourceY, targetX, targetY, linkStyle]);

  // Track mouse position for hover detection (needed for portal elements)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      (window as any).__lastMouseX = e.clientX;
      (window as any).__lastMouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

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
    // Only show menu on right-click (context menu)
    // This should NOT be called on left click
    e.preventDefault();
    e.stopPropagation();
    try {
      const menu = document.createElement('div');
      Object.assign(menu.style, {
        position: 'fixed',
        left: `${e.clientX}px`,
        top: `${e.clientY}px`,
        background: '#111827',
        color: '#E5E7EB',
        border: '1px solid #374151',
        borderRadius: '6px',
        padding: '6px',
        zIndex: 99999,
        fontSize: '12px',
      } as CSSStyleDeclaration);

      const mk = (label: string, style: LinkStyle) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.display = 'block';
        b.style.width = '100%';
        b.style.background = 'transparent';
        b.style.color = 'inherit';
        b.style.border = 'none';
        b.style.textAlign = 'left';
        b.style.padding = '4px 8px';
        b.onmouseenter = () => {
          b.style.background = '#1F2937';
        };
        b.onmouseleave = () => {
          b.style.background = 'transparent';
        };
        b.onclick = () => {
          try {
            if (typeof (props as any)?.data?.onUpdate === 'function') {
              (props as any).data.onUpdate({
                data: {
                  ...(props as any).data,
                  linkStyle: style
                }
              });
            }
          } catch {
            // Silent fail
          }
          try {
            document.body.removeChild(menu);
          } catch {
            // Silent fail
          }
        };
        return b;
      };

      menu.appendChild(mk('Bezier', LinkStyle.Bezier));
      menu.appendChild(mk('Ortogonale (smooth)', LinkStyle.SmoothStep));
      menu.appendChild(mk('Ortogonale (step)', LinkStyle.Step));
      menu.appendChild(mk('HVH', LinkStyle.HVH));
      menu.appendChild(mk('VHV', LinkStyle.VHV));

      const close = () => {
        try {
          document.body.removeChild(menu);
        } catch {
          // Silent fail
        }
      };
      setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
      document.body.appendChild(menu);
    } catch {
      // Silent fail
    }
  };

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

  // Get control points from data or extract from path
  const getControlPoints = useCallback((): ControlPoint[] => {
    // If controlPoints exist in data, use them
    const dataControlPoints = (data as any)?.controlPoints;
    if (dataControlPoints && Array.isArray(dataControlPoints) && dataControlPoints.length > 0) {
      return dataControlPoints.map((cp: { x: number; y: number }, idx: number) => ({
        x: cp.x,
        y: cp.y,
        id: `cp-${idx}`,
      }));
    }

    // Otherwise, extract vertices from path
    if (pathRef.current) {
      const pathString = pathRef.current.getAttribute('d') || '';
      const vertices = extractPathVertices(pathString);
      // Filter out source and target points (keep only intermediate vertices)
      return vertices.slice(1, -1).map((v, idx) => ({
        ...v,
        id: `v-${idx}`,
      }));
    }

    return [];
  }, [data, pathRef]);

  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);

  // Update control points when path or data changes
  useEffect(() => {
    const points = getControlPoints();
    setControlPoints(points);
  }, [getControlPoints, pathRef.current, (data as any)?.controlPoints]);

  const handleControlPointsChange = useCallback(
    (points: ControlPoint[]) => {
      setControlPoints(points);
      if (props.data && typeof props.data.onUpdate === 'function') {
        const controlPointsData = points.map((p) => ({ x: p.x, y: p.y }));
        props.data.onUpdate({
          data: {
            ...props.data,
            controlPoints: controlPointsData,
          }
        });
      }
    },
    [props.data]
  );

  // Label drag hook with intelligent snap logic
  const handleLabelPositionChange = useCallback((newSvgPosition: { x: number; y: number }) => {
    // La posizione è già in coordinate SVG
    console.log('Saving label position:', newSvgPosition); // DEBUG
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({
        data: {
          ...props.data,
          labelPositionSvg: newSvgPosition,
        }
      });
    }
  }, [props.data]);

  const labelDrag = useLabelDrag({
    labelRef: hoverRefs.labelRef,
    initialPosition: positions.labelScreenPosition,
    pathRef: pathRef,
    savedLabelSvgPosition: savedLabelSvgPosition,
    onPositionChange: handleLabelPositionChange,
    enabled: !!label, // Only enable if label exists
    snapThreshold: 30, // 30px threshold for snap detection (increased from 18px)
  });

  const handleShiftClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Convert click position to SVG coordinates
    const svg = pathRef.current?.ownerSVGElement;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const svgPoint = pt.matrixTransform(ctm.inverse());

    // Find the closest point on the path
    if (pathRef.current) {
      const path = pathRef.current;
      const pathLength = path.getTotalLength();
      let minDistance = Infinity;
      let closestPoint = { x: svgPoint.x, y: svgPoint.y };
      let closestT = 0;

      // Sample points along the path
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const point = path.getPointAtLength(pathLength * t);
        const dist = Math.sqrt(
          Math.pow(point.x - svgPoint.x, 2) + Math.pow(point.y - svgPoint.y, 2)
        );
        if (dist < minDistance) {
          minDistance = dist;
          closestPoint = point;
          closestT = t;
        }
      }

      // Only add if not too close to existing points
      const tooClose = controlPoints.some((cp) => {
        const dist = Math.sqrt(
          Math.pow(cp.x - closestPoint.x, 2) + Math.pow(cp.y - closestPoint.y, 2)
        );
        return dist < 20; // 20px threshold
      });

      if (!tooClose && minDistance < 50) {
        // Add new control point
        const newPoint: ControlPoint = {
          x: closestPoint.x,
          y: closestPoint.y,
          id: `cp-${Date.now()}`,
        };
        const updatedPoints = [...controlPoints, newPoint].sort((a, b) => {
          // Sort by position along path (approximate)
          const distA = Math.sqrt(Math.pow(a.x - sourceX, 2) + Math.pow(a.y - sourceY, 2));
          const distB = Math.sqrt(Math.pow(b.x - sourceX, 2) + Math.pow(b.y - sourceY, 2));
          return distA - distB;
        });
        handleControlPointsChange(updatedPoints);
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
        controlPoints={controlPoints.length > 0 ? controlPoints.map((cp) => ({ x: cp.x, y: cp.y })) : undefined}
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

      {/* Control Points (Phase 2) */}
      {(hover.state.hovered || props.selected) && (
        <EdgeControlPoints
          controlPoints={controlPoints}
          onControlPointsChange={handleControlPointsChange}
          pathRef={pathRef}
          hovered={hover.state.hovered}
          selected={props.selected}
          enableSnapping={false}
          snapDistance={10}
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
    </>
  );
};

export default CustomEdge;
