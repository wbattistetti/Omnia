/**
 * Calcola la posizione schermo per ancorare l’Intellisense sul nuovo link (due nodi esistenti),
 * usando la stessa geometria VHV degli handle del path disegnato.
 */

import { Connection, internalsSymbol } from 'reactflow';
import { intellisenseAnchorFlowFromHandles } from '../edges/utils/edgeRouting';
import type { ReactFlowStoreLike } from './waitForHandleBounds';

type FlowToScreen = { flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number } };

export function computeLinkMidScreenFromConnection(
  storeApi: ReactFlowStoreLike,
  reactFlowInstance: FlowToScreen,
  connection: Connection,
  fallbackScreen: { x: number; y: number }
): { x: number; y: number } {
  const { source, target, sourceHandle, targetHandle } = connection;
  if (!source || !target) return fallbackScreen;

  const nodeInternals = storeApi.getState().nodeInternals as Map<string, any>;
  const srcInternal = nodeInternals.get(source);
  const tgtInternal = nodeInternals.get(target);

  const srcHandles = srcInternal?.[internalsSymbol as any]?.handleBounds?.source as
    | Array<{ id: string; x: number; y: number; width: number; height: number }>
    | undefined;
  const tgtHandles = tgtInternal?.[internalsSymbol as any]?.handleBounds?.target as
    | Array<{ id: string; x: number; y: number; width: number; height: number }>
    | undefined;

  const srcHandle = srcHandles?.find((h) => h.id === sourceHandle) ?? srcHandles?.[0];
  const tgtHandle = tgtHandles?.find((h) => h.id === targetHandle) ?? tgtHandles?.[0];

  if (!srcHandle || !tgtHandle || !srcInternal || !tgtInternal) {
    return fallbackScreen;
  }

  const srcP = srcInternal[internalsSymbol as any]?.positionAbsolute ?? srcInternal.positionAbsolute;
  const tgtP = tgtInternal[internalsSymbol as any]?.positionAbsolute ?? tgtInternal.positionAbsolute;

  const sx = (srcP?.x ?? 0) + srcHandle.x + srcHandle.width / 2;
  const sy = (srcP?.y ?? 0) + srcHandle.y + srcHandle.height / 2;
  const tx = (tgtP?.x ?? 0) + tgtHandle.x + tgtHandle.width / 2;
  const ty = (tgtP?.y ?? 0) + tgtHandle.y + tgtHandle.height / 2;

  const anchorFlow = intellisenseAnchorFlowFromHandles(sx, sy, tx, ty);
  return reactFlowInstance.flowToScreenPosition(anchorFlow);
}
