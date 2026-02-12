import { useCallback, useRef } from 'react';
import { Node } from 'reactflow';
import type { FlowNode, EdgeData } from '../types/flowTypes';
import type { Edge } from 'reactflow';
import { dlog } from '@utils/debug';

/**
 * Hook for managing Flow Editor event handlers
 *
 * Centralizes all React Flow event handlers (onPaneClick, onNodeDrag, onSelectionChange, etc.)
 * to keep FlowEditor.tsx clean and focused on orchestration.
 */
export function useFlowEventHandlers(
  reactFlowInstance: any,
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
  // Rigid drag context for dragging nodes with descendants
  const rigidDragCtxRef = useRef<null | {
    rootId: string;
    ids: Set<string>;
    startPositions: Map<string, { x: number; y: number }>;
    rootStart: { x: number; y: number };
    rootLast: { x: number; y: number };
  }>(null);

  // Helper functions for rigid drag logic
  const applyRigidDragMovement = useCallback((ctx: any, draggedNode: Node, setNodes: any) => {
    if (draggedNode.id !== ctx.rootId) return;
    const curX = (draggedNode.position as any).x;
    const curY = (draggedNode.position as any).y;
    const incDx = curX - ctx.rootLast.x;
    const incDy = curY - ctx.rootLast.y;
    if (incDx === 0 && incDy === 0) return;

    setNodes((nds: Node<FlowNode>[]) => nds.map(n => {
      if (!ctx.ids.has(n.id)) return n;
      if (n.id === draggedNode.id) return draggedNode;
      const pos = n.position as any;
      return { ...n, position: { x: pos.x + incDx, y: pos.y + incDy } } as any;
    }));

    ctx.rootLast = { x: curX, y: curY };
  }, []);

  const applyFinalRigidDragOffset = useCallback((ctx: any, nodesRef: any, setNodes: any) => {
    const rootNow = nodesRef.current.find((n: Node) => n.id === ctx.rootId);
    if (rootNow) {
      const finalDx = (rootNow.position as any).x - ctx.rootLast.x;
      const finalDy = (rootNow.position as any).y - ctx.rootLast.y;
      if (finalDx !== 0 || finalDy !== 0) {
        setNodes((nds: Node<FlowNode>[]) => nds.map(n => {
          if (!ctx.ids.has(n.id)) return n;
          if (n.id === ctx.rootId) return n;
          const pos = n.position as any;
          return { ...n, position: { x: pos.x + finalDx, y: pos.y + finalDy } } as any;
        }));
      }
    }
  }, []);

  /**
   * Handles pane click - deselects edges and dispatches custom event
   */
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setSelectedEdgeId(null);

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
   * Handles canvas double click - creates a new node at click position
   */
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Solo se il doppio click avviene DIRETTAMENTE sul pane (non dentro nodi)
    const isPane = target?.classList?.contains('react-flow__pane');
    if (!isPane) return;
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX;
    const y = e.clientY;
    createNodeAt(x, y);
  }, [createNodeAt]);

  /**
   * Handles node drag start - sets up rigid drag context if needed
   */
  const onNodeDragStart = useCallback((event: any, node: Node) => {
    // ✅ Con nodesDraggable={false}, questo non dovrebbe essere chiamato per drag normale
    // Solo quando attiviamo manualmente il drag dalla toolbar
    const target = event.target as Element;
    const isAnchor = target && (target.classList.contains('rigid-anchor') || target.closest('.rigid-anchor'));
    const isHandle = target && (
      target.classList.contains('react-flow__handle') ||
      target.closest('.react-flow__handle')
    );
    const hasNodrag = target && (target.classList.contains('nodrag') || target.closest('.nodrag'));
    const isToolbarDrag = (window as any).__isToolbarDrag === node.id;

    // ✅ Se viene chiamato con un handle, blocca
    if (isHandle) {
      (window as any).__dragStartedFromHandle = true;
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    (window as any).__dragStartedFromHandle = false;

    // ✅ BLOCCA se ha nodrag E non è un drag dalla toolbar
    if (hasNodrag && !isToolbarDrag) {
      (window as any).__blockNodeDrag = node.id;
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    // ✅ Permetti solo se è un drag dalla toolbar
    if (isToolbarDrag) {
      (window as any).__blockNodeDrag = null;
    } else {
      // ✅ Se non è toolbar drag, blocca (non dovrebbe succedere con nodesDraggable={false})
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    (window as any).__blockNodeDrag = null;
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
    } else {
      rigidDragCtxRef.current = null;
    }
  }, [nodes, edges]);

  /**
   * Handles node drag - applies rigid drag movement if context exists
   */
  const onNodeDrag = useCallback((event: any, draggedNode: Node) => {
    const isBlocked = (window as any).__blockNodeDrag === draggedNode.id;

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

    // ✅ Se il drag è partito da un handle, NON DOVREBBE ESSERE QUI
    if ((window as any).__dragStartedFromHandle) {
      return;
    }

    if (!rigidDragCtxRef.current) {
      return;
    }
    const ctx = rigidDragCtxRef.current;
    applyRigidDragMovement(ctx, draggedNode, setNodes);
  }, [setNodes, applyRigidDragMovement, nodes]);

  /**
   * Handles node drag stop - applies final rigid drag offset
   */
  const onNodeDragStop = useCallback((event: any, node: Node) => {
    // ✅ NOTA: onNodeDragStop NON viene chiamato quando si parte da un handle
    // grazie a noDragClassName="react-flow__handle"
    try { (window as any).__flowDragMode = undefined; } catch { }

    const ctx = rigidDragCtxRef.current;
    if (ctx) {
      const nodesRef = { current: nodes };
      applyFinalRigidDragOffset(ctx, nodesRef, setNodes);
    }
    rigidDragCtxRef.current = null;
  }, [setNodes, applyFinalRigidDragOffset, nodes]);

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
          const el = document.querySelector('.react-flow__selection') as HTMLElement | null;
          if (el) {
            const cs = getComputedStyle(el);
            dlog('flow', '[selectionRect]', { bg: cs.backgroundColor });
          }
        } catch { }
      }, 0);
    } catch { }
  }, [setSelectedNodeIds]);

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
      const rect = host ? host.getBoundingClientRect() : { left: 0, top: 0 } as any;
      const scrollX = host ? host.scrollLeft : 0;
      const scrollY = host ? host.scrollTop : 0;
      const x = (e.clientX - rect.left) + scrollX;
      const y = (e.clientY - rect.top) + scrollY;
      setSelectionMenu({ show: true, x, y });
    } catch { }
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
    const sx = (e.clientX - rect.left) + host.scrollLeft;
    const sy = (e.clientY - rect.top) + host.scrollTop;
    dragStartRef.current = { x: sx, y: sy };
  }, [canvasRef, dragStartRef, setPersistedSel]);

  return {
    onPaneClick,
    handlePaneMouseMove,
    handleCanvasDoubleClick,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    onSelectionChange,
    onMouseUp,
    onNodeDoubleClick,
    onMouseDown,
  };
}
