/**
 * Single source of truth for edge-mounted Intellisense anchor:
 * handle centers from React Flow store → flow anchor (`intellisenseAnchorFlowFromHandles`) → screen.
 * Used for pane-drop temp edges and for `onAfterConnect` between existing nodes.
 */

import { Connection, internalsSymbol } from 'reactflow';
import { intellisenseAnchorFlowFromHandles, orthoPortHintFromHandleIds } from '../edges/utils/edgeRouting';
import type { ReactFlowStoreLike } from './waitForHandleBounds';
import { targetHandleIdForTempEdge } from './tempNodePaneDropPosition';

export type HandleCenterPair = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
};

export type FlowToScreenLike = {
  flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number };
};

/**
 * Reads source/target handle centers in flow space from `nodeInternals` (same layout RF uses for edges).
 */
export function readHandleCentersFlowFromStore(params: {
  storeApi: ReactFlowStoreLike;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandleId?: string | null;
  targetHandleId?: string | null;
}): HandleCenterPair | null {
  const { storeApi, sourceNodeId, targetNodeId, sourceHandleId, targetHandleId } = params;
  const nodeInternals = storeApi.getState().nodeInternals as Map<string, unknown>;
  const srcInternal = nodeInternals.get(sourceNodeId) as Record<string, unknown> | undefined;
  const tgtInternal = nodeInternals.get(targetNodeId) as Record<string, unknown> | undefined;
  if (!srcInternal || !tgtInternal) return null;

  const srcHandles = srcInternal[internalsSymbol as any]?.handleBounds?.source as
    | Array<{ id: string; x: number; y: number; width: number; height: number }>
    | undefined;
  const tgtHandles = tgtInternal[internalsSymbol as any]?.handleBounds?.target as
    | Array<{ id: string; x: number; y: number; width: number; height: number }>
    | undefined;

  const srcHandle = srcHandles?.find((h) => h.id === sourceHandleId) ?? srcHandles?.[0];
  const tgtHandle = tgtHandles?.find((h) => h.id === targetHandleId) ?? tgtHandles?.[0];
  if (!srcHandle || !tgtHandle) return null;

  const srcP = srcInternal[internalsSymbol as any]?.positionAbsolute ?? srcInternal.positionAbsolute;
  const tgtP = tgtInternal[internalsSymbol as any]?.positionAbsolute ?? tgtInternal.positionAbsolute;
  if (srcP == null || tgtP == null) return null;

  return {
    sx: (srcP.x ?? 0) + srcHandle.x + srcHandle.width / 2,
    sy: (srcP.y ?? 0) + srcHandle.y + srcHandle.height / 2,
    tx: (tgtP.x ?? 0) + tgtHandle.x + tgtHandle.width / 2,
    ty: (tgtP.y ?? 0) + tgtHandle.y + tgtHandle.height / 2,
  };
}

/** Flow-space anchor for orth-style edge UI (matches `orthoPortHint` + path semantics in `edgeRouting`). */
export function anchorFlowForOrthEdgeLinkUI(
  centers: HandleCenterPair,
  sourceHandleId?: string | null,
  targetHandleId?: string | null,
): { x: number; y: number } {
  const portHint = orthoPortHintFromHandleIds(sourceHandleId, targetHandleId);
  return intellisenseAnchorFlowFromHandles(centers.sx, centers.sy, centers.tx, centers.ty, portHint);
}

export function linkMidScreenFromAnchorFlow(
  reactFlowInstance: FlowToScreenLike,
  anchorFlow: { x: number; y: number },
): { x: number; y: number } {
  return reactFlowInstance.flowToScreenPosition(anchorFlow);
}

/** Two existing nodes + `Connection` handles (e.g. after `onConnect`). */
export function computeLinkMidScreenFromConnectionUnified(
  storeApi: ReactFlowStoreLike,
  reactFlowInstance: FlowToScreenLike,
  connection: Connection,
  fallbackScreen: { x: number; y: number },
): { x: number; y: number } {
  const { source, target, sourceHandle, targetHandle } = connection;
  if (!source || !target) return fallbackScreen;

  const centers = readHandleCentersFlowFromStore({
    storeApi,
    sourceNodeId: source,
    targetNodeId: target,
    sourceHandleId: sourceHandle,
    targetHandleId: targetHandle,
  });
  if (!centers) return fallbackScreen;

  const anchorFlow = anchorFlowForOrthEdgeLinkUI(centers, sourceHandle, targetHandle);
  return linkMidScreenFromAnchorFlow(reactFlowInstance, anchorFlow);
}

export type TempEdgeAnchorResult = {
  linkMidScreen: { x: number; y: number };
  centers: HandleCenterPair;
  anchorFlow: { x: number; y: number };
};

/** Temp node edge: target handle derived from source (same as `useTemporaryNodes` edge). */
export function computeLinkMidScreenForTempEdgeUnified(params: {
  storeApi: ReactFlowStoreLike;
  reactFlowInstance: FlowToScreenLike;
  sourceNodeId: string;
  tempNodeId: string;
  sourceHandleId: string;
}): TempEdgeAnchorResult | null {
  const targetHandleId = targetHandleIdForTempEdge(params.sourceHandleId);
  const centers = readHandleCentersFlowFromStore({
    storeApi,
    sourceNodeId: params.sourceNodeId,
    targetNodeId: params.tempNodeId,
    sourceHandleId: params.sourceHandleId,
    targetHandleId,
  });
  if (!centers) return null;

  const anchorFlow = anchorFlowForOrthEdgeLinkUI(centers, params.sourceHandleId, targetHandleId);
  return {
    centers,
    anchorFlow,
    linkMidScreen: linkMidScreenFromAnchorFlow(params.reactFlowInstance, anchorFlow),
  };
}
