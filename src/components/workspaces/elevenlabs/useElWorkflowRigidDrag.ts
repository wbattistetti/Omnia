/**
 * Rigid subtree drag for ElevenLabs workflow canvas (anchor handle moves all descendants).
 */

import { useCallback, useRef } from 'react';
import type { Edge, Node, NodeDragHandler } from 'reactflow';
import { getDescendantNodeIds, translateNodes } from '../../../flow/utils/graphTransforms';

export type RigidDragContext = {
  rootId: string;
  translateIds: Set<string>;
  rootLast: { x: number; y: number };
};

export const EL_RIGID_ANCHOR_CLASS = 'el-rigid-anchor';

function isRigidAnchorTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.classList.contains(EL_RIGID_ANCHOR_CLASS) ||
    !!target.closest(`.${EL_RIGID_ANCHOR_CLASS}`)
  );
}

export function useElWorkflowRigidDrag(
  edges: Edge[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
): {
  onNodeDragStart: NodeDragHandler;
  onNodeDrag: NodeDragHandler;
  onNodeDragStop: NodeDragHandler;
} {
  const rigidDragCtxRef = useRef<RigidDragContext | null>(null);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const onNodeDragStart: NodeDragHandler = useCallback((event, node) => {
    if (!isRigidAnchorTarget(event.target)) {
      rigidDragCtxRef.current = null;
      return;
    }
    rigidDragCtxRef.current = {
      rootId: node.id,
      translateIds: getDescendantNodeIds(node.id, edgesRef.current),
      rootLast: { x: node.position.x, y: node.position.y },
    };
  }, []);

  const onNodeDrag: NodeDragHandler = useCallback((_, draggedNode) => {
    const ctx = rigidDragCtxRef.current;
    if (!ctx || draggedNode.id !== ctx.rootId) return;

    const curX = draggedNode.position.x;
    const curY = draggedNode.position.y;
    const incDx = curX - ctx.rootLast.x;
    const incDy = curY - ctx.rootLast.y;
    if (incDx === 0 && incDy === 0) return;

    setNodes((nds) => {
      const moved = translateNodes(nds, ctx.translateIds, incDx, incDy);
      return moved.map((n) => (n.id === draggedNode.id ? draggedNode : n));
    });
    ctx.rootLast = { x: curX, y: curY };
  }, [setNodes]);

  const onNodeDragStop: NodeDragHandler = useCallback(() => {
    rigidDragCtxRef.current = null;
  }, []);

  return { onNodeDragStart, onNodeDrag, onNodeDragStop };
}
