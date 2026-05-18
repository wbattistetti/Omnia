/**
 * Toolbar handle drag (NodeToolbar is outside RF node DOM — native drag does not start there).
 * Preview via ephemeral overlay; FlowStore commit on NODE_POSITION_COMMITTED only.
 */

import type { Edge, Node, Viewport } from 'reactflow';
import { FlowStateBridge } from '../../../services/FlowStateBridge';
import { getFlowCanvasHost, resolveFlowPaneElement } from './flowCanvasDom';
import { flowCanvasDiag, nextFlowCanvasTraceId, summarizeNodePositions } from './flowCanvasDiagnostics';
import { isFinitePoint, isFinitePosition } from './flowPositionGuards';
import { paneRectFromElement, screenPointToFlow } from './flowScreenProjection';
import { emitNodePositionCommitted } from '../semantic/flowCanvasSemanticEvents';

/** Screen pixels before drag mode activates (avoids commit on toolbar click). */
export const TOOLBAR_DRAG_THRESHOLD_PX = 5;

export type ToolbarDragPointer = { clientX: number; clientY: number };

export type StartToolbarNodeDragOptions = {
  nodeId: string;
  flowCanvasId: string;
  pointer: ToolbarDragPointer;
  mode: 'move' | 'rigid';
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  getViewport: () => Viewport;
  getNode: (id: string) => Node | undefined;
  getDescendantNodeIds: (rootId: string, edges: Edge[]) => Set<string>;
  getEdges: () => Edge[];
  translateNodes: (nodes: Node[], ids: Set<string>, dx: number, dy: number) => Node[];
  onDraggingChange?: (dragging: boolean) => void;
};

function resolvePaneRect(flowCanvasId: string): ReturnType<typeof paneRectFromElement> {
  const host = getFlowCanvasHost(flowCanvasId);
  return paneRectFromElement(resolveFlowPaneElement(host));
}

function pointerToFlow(
  clientX: number,
  clientY: number,
  screenToFlowPosition: StartToolbarNodeDragOptions['screenToFlowPosition'],
  getViewport: () => Viewport,
  flowCanvasId: string
): { x: number; y: number } | null {
  const fromRf = screenToFlowPosition({ x: clientX, y: clientY });
  if (isFinitePoint(fromRf)) return fromRf;

  const pane = resolvePaneRect(flowCanvasId);
  if (!pane) return null;
  return screenPointToFlow(clientX, clientY, getViewport(), pane);
}

function applyEphemeralPreview(
  updates: Array<{ nodeId: string; position: { x: number; y: number } }>
): void {
  FlowStateBridge.getApplyEphemeralDrag()?.(updates);
}

function buildPreviewUpdates(
  nodes: Node[],
  nodeId: string,
  rootPosition: { x: number; y: number },
  rigidDescendantIds: Set<string> | null,
  incDx: number,
  incDy: number,
  translateNodesFn: StartToolbarNodeDragOptions['translateNodes']
): Array<{ nodeId: string; position: { x: number; y: number } }> {
  if (!rigidDescendantIds || rigidDescendantIds.size === 0) {
    return [{ nodeId, position: rootPosition }];
  }
  const moved = translateNodesFn(nodes, rigidDescendantIds, incDx, incDy);
  const byId = new Map(moved.map((n) => [n.id, n.position]));
  byId.set(nodeId, rootPosition);
  return Array.from(byId.entries())
    .filter(([id]) => id === nodeId || rigidDescendantIds.has(id))
    .map(([id, position]) => ({ nodeId: id, position: { ...position } }));
}

function screenDistance(a: ToolbarDragPointer, b: { clientX: number; clientY: number }): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

/** Document-level drag; required because toolbar lives in NodeToolbar portal. */
export function startToolbarNodeDrag(options: StartToolbarNodeDragOptions): void {
  const {
    nodeId,
    flowCanvasId,
    pointer,
    mode,
    screenToFlowPosition,
    getViewport,
    getNode,
    getDescendantNodeIds,
    getEdges,
    translateNodes,
    onDraggingChange,
  } = options;

  const getNodesSnapshot = (): Node[] => {
    const fromBridge = FlowStateBridge.getNodes();
    if (fromBridge?.length) return fromBridge as Node[];
    const n = getNode(nodeId);
    return n ? [n] : [];
  };

  if (document.querySelector('.node-row-outer[data-being-dragged="true"]')) {
    flowCanvasDiag('toolbarDrag.blocked', { reason: 'row_drag_active' });
    return;
  }

  const currentNode = getNode(nodeId);
  if (!currentNode || !isFinitePosition(currentNode.position)) {
    flowCanvasDiag('toolbarDrag.blocked', { reason: 'no_node_or_position', nodeId });
    return;
  }

  const flowAtPointerStart = pointerToFlow(
    pointer.clientX,
    pointer.clientY,
    screenToFlowPosition,
    getViewport,
    flowCanvasId
  );
  if (!isFinitePoint(flowAtPointerStart)) {
    flowCanvasDiag('toolbarDrag.blocked', {
      reason: 'pointer_to_flow_failed',
      pointer,
      nodeId,
      viewport: getViewport(),
    });
    return;
  }

  const nodeStart = { x: currentNode.position.x, y: currentNode.position.y };
  const isRigidDrag = mode === 'rigid';
  const rigidDescendantIds = isRigidDrag ? getDescendantNodeIds(nodeId, getEdges()) : null;
  let lastRootPos = { ...nodeStart };
  let active = true;
  let dragActivated = false;
  const traceId = nextFlowCanvasTraceId('drag');

  const activateDrag = () => {
    if (dragActivated) return;
    dragActivated = true;
    FlowStateBridge.setDragMode(isRigidDrag ? 'rigid' : null);
    FlowStateBridge.setToolbarDragNodeId(nodeId);
    FlowStateBridge.setBlockNodeDrag(false);
    onDraggingChange?.(true);
    document.body.style.cursor = 'move';
    flowCanvasDiag('toolbarDrag.start', {
      traceId,
      nodeId,
      mode,
      nodeStart,
      flowAtPointerStart,
      bridgeNodes: summarizeNodePositions(getNodesSnapshot()),
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (document.querySelector('.node-row-outer[data-being-dragged="true"]')) {
      endDrag('row_drag_active');
      return;
    }
    if (!active) return;

    if (!dragActivated) {
      if (screenDistance(pointer, e) < TOOLBAR_DRAG_THRESHOLD_PX) return;
      activateDrag();
    }

    const flowNow = pointerToFlow(e.clientX, e.clientY, screenToFlowPosition, getViewport, flowCanvasId);
    if (!isFinitePoint(flowNow)) return;

    const newPosition = {
      x: nodeStart.x + (flowNow.x - flowAtPointerStart.x),
      y: nodeStart.y + (flowNow.y - flowAtPointerStart.y),
    };
    if (!isFinitePosition(newPosition)) return;

    const incDx = newPosition.x - lastRootPos.x;
    const incDy = newPosition.y - lastRootPos.y;
    if (incDx === 0 && incDy === 0) return;

    lastRootPos = { x: newPosition.x, y: newPosition.y };

    const snapshot = getNodesSnapshot();
    const updates = buildPreviewUpdates(
      snapshot,
      nodeId,
      newPosition,
      rigidDescendantIds,
      incDx,
      incDy,
      translateNodes
    );
    applyEphemeralPreview(updates);
  };

  const endDrag = (reason = 'mouseup') => {
    if (!active) return;
    active = false;
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('mouseup', handleMouseUp, true);

    const moved =
      Math.abs(lastRootPos.x - nodeStart.x) > 0.01 || Math.abs(lastRootPos.y - nodeStart.y) > 0.01;

    if (dragActivated && moved && isFinitePosition(lastRootPos)) {
      const snapshot = getNodesSnapshot();
      let updates: Array<{ nodeId: string; position: { x: number; y: number } }>;
      if (isRigidDrag && rigidDescendantIds && rigidDescendantIds.size > 0) {
        const totalDx = lastRootPos.x - nodeStart.x;
        const totalDy = lastRootPos.y - nodeStart.y;
        const movedNodes = translateNodes(snapshot, rigidDescendantIds, totalDx, totalDy);
        updates = movedNodes
          .filter((n) => n.id === nodeId || rigidDescendantIds.has(n.id))
          .map((n) => ({
            nodeId: n.id,
            position:
              n.id === nodeId ? { ...lastRootPos } : { x: n.position.x, y: n.position.y },
          }));
      } else {
        updates = [{ nodeId, position: { ...lastRootPos } }];
      }
      flowCanvasDiag('toolbarDrag.commit', {
        traceId,
        nodeId,
        reason,
        nodeStart,
        finalPos: lastRootPos,
        updates,
        bridgeBefore: summarizeNodePositions(snapshot),
      });
      emitNodePositionCommitted(flowCanvasId, updates);
    } else {
      FlowStateBridge.getClearEphemeralDrag()?.();
      flowCanvasDiag('toolbarDrag.cancel', {
        traceId,
        nodeId,
        reason,
        dragActivated,
        moved,
        nodeStart,
        lastRootPos,
      });
    }

    FlowStateBridge.setToolbarDragNodeId(null);
    FlowStateBridge.setDragMode(null);
    if (dragActivated) {
      onDraggingChange?.(false);
      document.body.style.cursor = 'default';
    }
  };

  const handleMouseUp = () => endDrag('mouseup');

  document.addEventListener('mousemove', handleMouseMove, { capture: true });
  document.addEventListener('mouseup', handleMouseUp, { capture: true });
}
