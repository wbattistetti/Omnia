/**
 * Builds event detail / orchestrator hints from {@link DragRowPayload}-shaped inputs.
 * Centralises cross-node payload shape so DnD handlers converge on one builder (Phase 2).
 */

import type { DragRowPayload } from './dndRowPayloadTypes';

/** Detail shape dispatched with `crossNodeRowMove` (compatible with orchestrators). */
export type CrossNodeRowMoveDetail = Record<string, unknown>;

/**
 * Builds the CustomEvent detail for cross-node drops (same contract as useNodeDragDrop historically).
 */
export function buildCrossNodeRowMoveDetail(params: {
  fromNodeId: string;
  toNodeId: string;
  draggedRowId: string;
  rowData: DragRowPayload['rowData'];
  draggedRowIndex: number;
  mousePosition: { x: number; y: number };
  fromFlowCanvasId: string;
  toFlowCanvasId: string;
  targetRowId: string | null;
  targetRegion: DragRowPayload['targetRegion'];
  portalRowIdOnTargetNode?: string | null;
  targetRowInsertIndex?: number;
}): CrossNodeRowMoveDetail {
  const {
    fromNodeId,
    toNodeId,
    draggedRowId,
    rowData,
    draggedRowIndex,
    mousePosition,
    fromFlowCanvasId,
    toFlowCanvasId,
    targetRowId,
    targetRegion,
    portalRowIdOnTargetNode,
    targetRowInsertIndex,
  } = params;

  return {
    fromNodeId,
    toNodeId,
    rowId: draggedRowId,
    rowData,
    originalIndex: draggedRowIndex,
    mousePosition,
    fromFlowCanvasId,
    toFlowCanvasId,
    targetRowId,
    targetRegion,
    ...(portalRowIdOnTargetNode !== undefined ? { portalRowIdOnTargetNode } : {}),
    _state: { handled: false },
    ...(targetRowInsertIndex !== undefined ? { targetRowInsertIndex } : {}),
  };
}

/**
 * Infer command kind from payload for diagnostics (routing still uses StructuralOrchestrator internally).
 */
export function inferDndRowCommandKind(p: DragRowPayload): import('./dndRowPayloadTypes').DndRowCommandKind {
  const sf = String(p.sourceFlowId || '').trim();
  const tf = String(p.targetFlowId || '').trim();
  const sn = String(p.sourceNodeId ?? '').trim();
  const tn = String(p.targetNodeId ?? '').trim();

  if (p.targetRegion === 'portal') {
    return 'MoveRowToSubflow';
  }
  if (!tn && p.targetNodeId === null) {
    return 'MoveRowToCanvas';
  }
  if (sf === tf && sn && tn && sn === tn) {
    return 'MoveRowWithinNode';
  }
  if (sf.startsWith('subflow_') && tf === 'main') {
    return 'MoveRowFromSubflowToParent';
  }
  return 'MoveRowToNode';
}
