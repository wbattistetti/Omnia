/**
 * Builds event detail / orchestrator hints from {@link DragRowPayload}-shaped inputs.
 * Centralises cross-node payload shape so DnD handlers converge on one builder (Phase 2).
 */

import type { DragRowPayload } from './dndRowPayloadTypes';
import type { NodeRowData } from '@types/project';

/** One id per cross-node row drag; propagate in `crossNodeRowMove` detail for trace logs. */
export function newDndTraceId(): string {
  try {
    const c = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
    if (c && typeof c.randomUUID === 'function') {
      return c.randomUUID();
    }
  } catch {
    /* noop */
  }
  return `dnd-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

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
  /** Correlates one drag gesture with apply/rename logs (`omnia.taskSubflowMoveTrace`). */
  dndTraceId?: string;
  /** Same value as `dndTraceId` for structured `[DnD:*]` / `[Subflow:*]` logs. */
  operationId?: string;
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
    dndTraceId,
    operationId,
  } = params;

  const trace = String(dndTraceId || '').trim();
  const op = String(operationId || '').trim();

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
    ...(trace ? { dndTraceId: trace } : {}),
    ...(op ? { operationId: op } : {}),
  };
}

/**
 * Infer command kind from payload for diagnostics (routing still uses StructuralOrchestrator internally).
 */
export function inferDndRowCommandKind(p: DragRowPayload): import('./dndRowPayloadTypes').DndRowCommandKind {
  const sf = String(p.sourceFlowId || '').trim();
  const tf = String(p.targetFlowId || '').trim();
  const sn = String(p.sourceNodeId ?? '').trim();
  const tnRaw = p.targetNodeId;
  const tn = tnRaw === null || tnRaw === undefined ? '' : String(tnRaw).trim();

  if (p.targetRegion === 'portal') {
    return 'MoveRowToSubflow';
  }
  /** Pane / canvas extract: no target node id. */
  if (tnRaw === null || tnRaw === undefined) {
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

/** Detail for `createNodeFromRow` window event (FlowEditor listener). */
export type CreateNodeFromRowEventDetail = {
  fromNodeId: string;
  rowId: string;
  rowData: NodeRowData;
  cloneScreenPosition: { x: number; y: number };
  flowCanvasId: string;
  /** Same id as {@link CreateNodeFromRowEventDetail.dndTraceId} for gesture correlation. */
  operationId?: string;
  /** Correlates canvas extract → node creation → subflow apply (same as cross-node `dndTraceId`). */
  dndTraceId?: string;
};

export function buildCreateNodeFromRowDetail(params: CreateNodeFromRowEventDetail): CreateNodeFromRowEventDetail {
  const trace = String(params.dndTraceId || '').trim();
  const op = String(params.operationId || '').trim();
  return {
    fromNodeId: String(params.fromNodeId || '').trim(),
    rowId: String(params.rowId || '').trim(),
    rowData: params.rowData,
    cloneScreenPosition: { ...params.cloneScreenPosition },
    flowCanvasId: String(params.flowCanvasId || 'main').trim() || 'main',
    ...(op ? { operationId: op } : {}),
    ...(trace ? { dndTraceId: trace } : {}),
  };
}

/** Build a {@link DragRowPayload} for logging / routing tests (same-node reorder before commit). */
export function buildDragPayloadSameNodeReorder(params: {
  flowCanvasId: string;
  nodeId: string;
  rowId: string;
  rowData: NodeRowData;
  sourceIndex: number;
  targetRowInsertIndex: number;
}): DragRowPayload {
  return {
    operation: 'move',
    rowId: params.rowId,
    rowData: params.rowData,
    sourceFlowId: params.flowCanvasId,
    sourceNodeId: params.nodeId,
    sourceIndex: params.sourceIndex,
    targetFlowId: params.flowCanvasId,
    targetNodeId: params.nodeId,
    targetRowId: null,
    targetRegion: 'row',
    targetRowInsertIndex: params.targetRowInsertIndex,
  };
}

/** Build payload for pane drop → new node (target node absent). */
export function buildDragPayloadCanvasExtract(params: {
  flowCanvasId: string;
  sourceNodeId: string;
  rowId: string;
  rowData: NodeRowData;
  sourceIndex: number;
  targetFlowCanvasId: string;
}): DragRowPayload {
  return {
    operation: 'move',
    rowId: params.rowId,
    rowData: params.rowData,
    sourceFlowId: params.flowCanvasId,
    sourceNodeId: params.sourceNodeId,
    sourceIndex: params.sourceIndex,
    targetFlowId: params.targetFlowCanvasId,
    targetNodeId: null,
    targetRowId: null,
    targetRegion: 'node',
  };
}
