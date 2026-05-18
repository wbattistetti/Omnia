/**
 * Writes measured DOM size onto the React Flow node (store) for MiniMap / bounds.
 */

import type { Node } from 'reactflow';

const SIZE_EPSILON_PX = 2;

export function commitNodeMeasuredDimensions(
  nodeId: string,
  width: number,
  height: number,
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  updateNodeInternals: (id: string) => void
): void {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w < 1 || h < 1) return;

  let changed = false;
  setNodes((nds) => {
    const node = nds.find((n) => n.id === nodeId);
    if (!node) return nds;
    const prevW = Number(node.width) || 0;
    const prevH = Number(node.height) || 0;
    if (Math.abs(prevW - w) <= SIZE_EPSILON_PX && Math.abs(prevH - h) <= SIZE_EPSILON_PX) {
      return nds;
    }
    changed = true;
    return nds.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            width: w,
            height: h,
            style: { ...n.style, width: w, height: h },
          }
        : n
    );
  });

  if (changed) {
    try {
      updateNodeInternals(nodeId);
    } catch {
      /* RF may not be ready */
    }
  }
}
