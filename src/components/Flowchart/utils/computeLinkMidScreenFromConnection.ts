/**
 * Calcola la posizione schermo per ancorare l’Intellisense sul nuovo link (due nodi esistenti),
 * delegando a `edgeIntellisenseAnchorFromHandles` (unica geometria handle → anchor → schermo).
 */

import { Connection } from 'reactflow';
import type { ReactFlowStoreLike } from './waitForHandleBounds';
import { computeLinkMidScreenFromConnectionUnified } from './edgeIntellisenseAnchorFromHandles';

type FlowToScreen = { flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number } };

export function computeLinkMidScreenFromConnection(
  storeApi: ReactFlowStoreLike,
  reactFlowInstance: FlowToScreen,
  connection: Connection,
  fallbackScreen: { x: number; y: number },
): { x: number; y: number } {
  return computeLinkMidScreenFromConnectionUnified(storeApi, reactFlowInstance, connection, fallbackScreen);
}
