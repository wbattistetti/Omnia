import { useCallback, useEffect, useRef } from 'react';
import { Node } from 'reactflow';
import type { FlowNode, EdgeData } from '@components/Flowchart/types/flowTypes';
import type { Edge } from 'reactflow';
import { dlog } from '@utils/debug';
import { FlowStateBridge } from '../../../services/FlowStateBridge';
import { getFlowFocusManager } from '@features/focus';
import { getDescendantNodeIds, translateNodes } from '../../../flow/utils/graphTransforms';
import { queryWithinFlowCanvasHost } from '../utils/flowCanvasDom';
import { flowCanvasDiag } from '../utils/flowCanvasDiagnostics';
import { emitNodePositionCommitted } from '../semantic/flowCanvasSemanticEvents';

/**
 * Hook for managing Flow Editor event handlers
 *
 * Centralizes all React Flow event handlers (onPaneClick, onNodeDrag, onSelectionChange, etc.)
 * to keep FlowEditor.tsx clean and focused on orchestration.
 */
export function useFlowEventHandlers(
  reactFlowInstance: any,
  flowCanvasId: string,
  nodes: Node<FlowNode>[],
  edges: Edge<EdgeData>[],
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNode>[]>>,
  setSelectedEdgeId: (id: string | null) => void,
  setSelectedNodeIds: (ids: string[]) => void,
  setSelectionMenu: (menu: { show: boolean; x: number; y: number }) => void,
  setCursorTooltip: (text: string | null, x?: number, y?: number) => void,
  createNodeAt: (x: number, y: number, initialRow?: any) => void,
  canvasRef: React.RefObject<HTMLDivElement>,
  dragStartRef: React.MutableRefObject<{ x: number; y: number } | null>,
  setPersistedSel: (sel: { x: number; y: number; w: number; h: number } | null) => void,
  selectedNodeIds: string[],
  onOpenTaskFlow?: (flowId: string, title: string) => void
) {
  // Rigid drag context: translateIds = nodes that receive incremental translation (never the dragged root)
  const rigidDragCtxRef = useRef<null | {
    rootId: string;
    translateIds: Set<string>;
    rootLast: { x: number; y: number };
  }>(null);

  const applyRigidDragMovement = useCallback((ctx: any, draggedNode: Node) => {
    if (draggedNode.id !== ctx.rootId) return;
    const curX = (draggedNode.position as any).x;
    const curY = (draggedNode.position as any).y;
    const incDx = curX - ctx.rootLast.x;
    const incDy = curY - ctx.rootLast.y;
    if (incDx === 0 && incDy === 0) return;

    const applyEphemeral = FlowStateBridge.getApplyEphemeralDrag();
    if (applyEphemeral) {
      const snapshot = FlowStateBridge.getNodes() as Node<FlowNode>[] | undefined;
      const nds = snapshot?.length ? snapshot : nodes;
      const moved = translateNodes(nds, ctx.translateIds, incDx, incDy);
      const updates = moved
        .filter((n) => n.id === draggedNode.id || ctx.translateIds.has(n.id))
        .map((n) => ({
          nodeId: n.id,
          position:
            n.id === draggedNode.id
              ? { x: curX, y: curY }
              : { x: n.position.x, y: n.position.y },
        }));
      applyEphemeral(updates);
    }

    ctx.rootLast = { x: curX, y: curY };
  }, [nodes]);

  const commitRigidDrag = useCallback((ctx: any, nodesSnapshot: Node<FlowNode>[]) => {
    const rootNow = nodesSnapshot.find((n) => n.id === ctx.rootId);
    if (!rootNow) return;
    const finalDx = (rootNow.position as any).x - ctx.rootLast.x;
    const finalDy = (rootNow.position as any).y - ctx.rootLast.y;
    let moved = nodesSnapshot;
    if (finalDx !== 0 || finalDy !== 0) {
      moved = translateNodes(nodesSnapshot, ctx.translateIds, finalDx, finalDy) as Node<FlowNode>[];
    }
    const updates = moved
      .filter((n) => n.id === ctx.rootId || ctx.translateIds.has(n.id))
      .map((n) => ({
        nodeId: n.id,
        position: { x: n.position.x, y: n.position.y },
      }));
    if (updates.length > 0) {
      emitNodePositionCommitted(String(flowCanvasId || 'main').trim(), updates);
    }
  }, [flowCanvasId]);

  /**
   * Handles pane click - deselects edges and dispatches custom event
   */
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setSelectedEdgeId(null);
    getFlowFocusManager().requestFocus('canvas');

    try {
      const ev = new CustomEvent('flow:canvas:click', { bubbles: true });
      window.dispatchEvent(ev);
    } catch { }
  }, [setSelectedEdgeId]);

  /**
   * Handles pane mouse move - shows tooltip when canvas is empty
   */
  const handlePaneMouseMove = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isPane = target?.classList?.contains('react-flow__pane') || !!target?.closest?.('.react-flow__pane');
    if (isPane && nodes.length === 0) {
      setCursorTooltip('Double-click to create a node', e.clientX, e.clientY);
    } else {
      setCursorTooltip(null);
    }
  }, [nodes.length, setCursorTooltip]);

  /**
   * Double-click on empty canvas: create node. Uses a native capture listener because
   * React Flow / selection can prevent the outer wrapper's React onDoubleClick from firing
   * (same approach as GrammarCanvasView).
   */
  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;

    const handleDoubleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isNode = !!target?.closest?.('.react-flow__node');
      const isEdge = !!target?.closest?.('.react-flow__edge');
      const isControl = !!target?.closest?.('.react-flow__controls');
      const isOnPane =
        target?.classList?.contains('react-flow__pane') || !!target?.closest?.('.react-flow__pane');
      if (!isOnPane || isNode || isEdge || isControl) return;
      e.stopPropagation();
      createNodeAt(e.clientX, e.clientY);
    };

    host.addEventListener('dblclick', handleDoubleClick, true);
    return () => {
      host.removeEventListener('dblclick', handleDoubleClick, true);
    };
  }, [createNodeAt, canvasRef]);

  /**
   * Handles node drag start - sets up rigid drag context if needed
   */
  const onNodeDragStart = useCallback((event: any, node: Node) => {
    const target = event.target as Element;
    flowCanvasDiag('rf.onNodeDragStart', { nodeId: node.id, target: (target as HTMLElement)?.className });
    const isAnchor = target && (target.classList.contains('rigid-anchor') || target.closest('.rigid-anchor'));
    const isHandle = target && (
      target.classList.contains('react-flow__handle') ||
      target.closest('.react-flow__handle')
    );
    const hasNodrag = target && (target.classList.contains('nodrag') || target.closest('.nodrag'));
    const isToolbarHandle =
      target &&
      (target.classList.contains('toolbar-drag-handle') ||
        target.closest('.toolbar-drag-handle') ||
        target.classList.contains('rigid-anchor') ||
        target.closest('.rigid-anchor'));

    if (isHandle) {
      FlowStateBridge.setDragStartedFromHandle(true);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    FlowStateBridge.setDragStartedFromHandle(false);

    if (hasNodrag && !isToolbarHandle) {
      FlowStateBridge.setBlockNodeDrag(true);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    const selectedSet = new Set(selectedNodeIds);
    const canDragSelectedGroup = selectedSet.size > 1 && selectedSet.has(node.id);

    if (!isToolbarHandle && !canDragSelectedGroup) {
      FlowStateBridge.setBlockNodeDrag(true);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    FlowStateBridge.setBlockNodeDrag(false);
    if (isToolbarHandle) {
      FlowStateBridge.setToolbarDragNodeId(node.id);
    }

    // If dragging a node inside a multi-selection, move the whole selection rigidly.
    // This is the primary behavior for group manipulation.
    if (canDragSelectedGroup) {
      const translateIds = new Set(selectedSet);
      translateIds.delete(node.id);
      rigidDragCtxRef.current = {
        rootId: node.id,
        translateIds,
        rootLast: { x: (node.position as any).x, y: (node.position as any).y },
      };
      return;
    }

    // Fallback: rigid drag from anchor keeps existing descendants behavior.
    if (FlowStateBridge.isRigidDrag() || isAnchor) {
      const rootId = node.id;
      rigidDragCtxRef.current = {
        rootId,
        translateIds: getDescendantNodeIds(rootId, edges),
        rootLast: { x: (node.position as any).x, y: (node.position as any).y },
      };
    } else {
      rigidDragCtxRef.current = null;
    }
  }, [nodes, edges, selectedNodeIds]);

  /**
   * Handles node drag - applies rigid drag movement if context exists
   */
  const onNodeDrag = useCallback((event: any, draggedNode: Node) => {
    const isBlocked = FlowStateBridge.isNodeDragBlocked(draggedNode.id);

    // ✅ Blocca il drag se è partito da un elemento nodrag
    if (isBlocked) {
      // Annulla il movimento ripristinando la posizione originale
      const originalNode = nodes.find(n => n.id === draggedNode.id);
      if (originalNode) {
        setNodes((nds) => nds.map((n) =>
          n.id === draggedNode.id ? { ...n, position: originalNode.position } : n
        ));
      }
      return;
    }

    // If drag started from a handle, skip
    if (FlowStateBridge.isDragStartedFromHandle()) {
      return;
    }

    if (!rigidDragCtxRef.current) {
      return;
    }
    const ctx = rigidDragCtxRef.current;
    applyRigidDragMovement(ctx, draggedNode);
  }, [applyRigidDragMovement, nodes]);

  /**
   * Handles node drag stop - applies final rigid drag offset
   */
  const onNodeDragStop = useCallback((event: any, node: Node) => {
    try {
      FlowStateBridge.setDragMode(null);
      FlowStateBridge.setToolbarDragNodeId(null);
      window.dispatchEvent(
        new CustomEvent('flowchart:toolbarDragEnd', {
          detail: { nodeId: node.id, flowCanvasId },
        })
      );
    } catch {
      /* noop */
    }

    const ctx = rigidDragCtxRef.current;
    if (ctx) {
      // Commit BEFORE clearing overlay — mirrors the toolbar drag path (bridge handles clear after
      // the NODE_POSITION_COMMITTED event). Clearing first creates a frame where overlay is gone
      // but the FlowStore hasn't updated yet, causing a one-frame snap to the old position.
      const snapshot = (FlowStateBridge.getNodes() as Node<FlowNode>[] | undefined) ?? nodes;
      commitRigidDrag(ctx, snapshot);
    }
    rigidDragCtxRef.current = null;
  }, [commitRigidDrag, nodes, flowCanvasId]);

  /**
   * Handles selection change - updates selected node IDs
   */
  const onSelectionChange = useCallback((sel: any) => {
    try {
      const ids = Array.isArray(sel?.nodes) ? sel.nodes.map((n: any) => n.id) : [];
      setSelectedNodeIds(ids);
      // Debug selezione solo su flag esplicito
      dlog('flow', '[selectionChange]', { count: ids.length });
      // verifica presenza del rettangolo di selezione e stili calcolati
      setTimeout(() => {
        try {
          const el = queryWithinFlowCanvasHost(
            canvasRef.current,
            '.react-flow__selection'
          );
          if (el) {
            const cs = getComputedStyle(el);
            dlog('flow', '[selectionRect]', { bg: cs.backgroundColor });
          }
        } catch { }
      }, 0);
    } catch { }
  }, [setSelectedNodeIds, canvasRef]);

  /**
   * Handles mouse up on ReactFlow - opens selection menu if 2+ nodes selected
   */
  const onMouseUp = useCallback((e: React.MouseEvent) => {
    // When user finishes a drag selection, open a contextual menu near the selection centroid
    try {
      if (!reactFlowInstance) return;
      // Usa la selezione live per evitare ritardi di stato
      const liveNodes: any[] = (reactFlowInstance as any).getNodes ? (reactFlowInstance as any).getNodes() : nodes;
      const liveSelectedIds = (liveNodes || []).filter(n => n?.selected).map(n => n.id);
      const effSelected = liveSelectedIds.length ? liveSelectedIds : selectedNodeIds;
      if (effSelected.length < 2) { setSelectionMenu({ show: false, x: 0, y: 0 }); return; }
      // sincronizza anche lo state locale, per coerenza
      try { if (liveSelectedIds.length) setSelectedNodeIds(liveSelectedIds); } catch { }
      // Use mouse release point relative to the FlowEditor container (account for scroll)
      const host = canvasRef.current;
      const rect = host ? host.getBoundingClientRect() : { left: 0, top: 0 };
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionMenu({ show: true, x, y });
    } catch { }
    // Persist the selection rectangle exactly as drawn
    try {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      const host = canvasRef.current;
      if (start && host) {
        const rect = host.getBoundingClientRect();
        const ex = e.clientX - rect.left;
        const ey = e.clientY - rect.top;
        const x = Math.min(start.x, ex);
        const y = Math.min(start.y, ey);
        const w = Math.abs(ex - start.x);
        const h = Math.abs(ey - start.y);
        if (w > 3 && h > 3) setPersistedSel({ x, y, w, h }); else setPersistedSel(null);
      }
    } catch { }
  }, [reactFlowInstance, nodes, selectedNodeIds, setSelectedNodeIds, setSelectionMenu, canvasRef, dragStartRef, setPersistedSel]);

  /**
   * Handles node double click - opens task flow if node is a task
   */
  const onNodeDoubleClick = useCallback((e: React.MouseEvent, node: Node) => {
    if (node?.type === 'task') {
      e.preventDefault();
      e.stopPropagation();
      const flowId = (node.data as any)?.flowId || node.id;
      const title = (node.data as any)?.label || 'Task';
      if (onOpenTaskFlow) onOpenTaskFlow(flowId, title);
    }
  }, [onOpenTaskFlow]);

  /**
   * Handles mouse down on canvas - stores drag start position for selection rectangle
   */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const tgt = e.target as HTMLElement;
    const isPane = tgt?.classList?.contains('react-flow__pane') || !!tgt?.closest?.('.react-flow__pane');
    if (!isPane) return;
    // reset previous persisted rectangle and store start in canvas coords (including scroll)
    setPersistedSel(null);
    const host = canvasRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    dragStartRef.current = { x: sx, y: sy };
  }, [canvasRef, dragStartRef, setPersistedSel]);

  return {
    onPaneClick,
    handlePaneMouseMove,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    onSelectionChange,
    onMouseUp,
    onNodeDoubleClick,
    onMouseDown,
  };
}
