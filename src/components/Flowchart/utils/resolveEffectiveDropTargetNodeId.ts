/**
 * Resolves the React Flow node id to use for row drop when elementFromPoint misses the node
 * (dual-pane: pointer often hits the pane instead of the card).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { findFlowIdContainingNode } from '@domain/taskSubflowMove/findFlowIdForNode';
import { normalizeFlowCanvasId } from '@components/FlowMappingPanel/flowInterfaceDragTypes';
import { resolveFlowCanvasIdUnderPointer } from './subflowRowDragCanvasPolicy';

export function resolveEffectiveDropTargetNodeId(params: {
  dropFromElementAtRelease: string | null;
  sourceNodeId: string;
  hoverTargetNodeId: string | null;
  sourceFlowCanvasId: string | undefined;
  ptrX: number;
  ptrY: number;
  flows: WorkspaceState['flows'];
}): string | null {
  const {
    dropFromElementAtRelease,
    sourceNodeId,
    hoverTargetNodeId,
    sourceFlowCanvasId,
    ptrX,
    ptrY,
    flows,
  } = params;
  const release = dropFromElementAtRelease?.trim() || null;
  if (release && release !== sourceNodeId) {
    return release;
  }
  const dropFlowId = resolveFlowCanvasIdUnderPointer(ptrX, ptrY);
  if (!dropFlowId) return release;
  const fromNorm = normalizeFlowCanvasId(sourceFlowCanvasId ?? 'main');
  const dropNorm = normalizeFlowCanvasId(dropFlowId);
  if (fromNorm === dropNorm) {
    return release;
  }
  if (!dropNorm.startsWith('subflow_')) {
    return release;
  }
  const hover = String(hoverTargetNodeId || '').trim();
  if (hover && hover !== sourceNodeId) {
    const flowOfHover = findFlowIdContainingNode(flows, hover);
    if (flowOfHover && normalizeFlowCanvasId(flowOfHover) === dropNorm) {
      return hover;
    }
  }
  const slice = flows[dropNorm] as { nodes?: Array<{ id?: string }> } | undefined;
  const nodes = slice?.nodes ?? [];
  if (nodes.length === 1) {
    const onlyId = String(nodes[0]?.id || '').trim();
    if (onlyId && onlyId !== sourceNodeId) return onlyId;
  }
  return release;
}
