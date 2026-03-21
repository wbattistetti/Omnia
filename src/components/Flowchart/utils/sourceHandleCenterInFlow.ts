import { internalsSymbol } from 'reactflow';
import type { ReactFlowStoreLike } from './waitForHandleBounds';

/**
 * Restituisce il centro dell'handle sorgente in coordinate flow, come usato da React Flow per disegnare l'edge.
 * Evita l'approssimazione `node.position + width/2` quando l'handle reale è spostato o il nodo ha misure diverse.
 */
export function getSourceHandleCenterInFlow(
  store: ReactFlowStoreLike,
  sourceNodeId: string,
  sourceHandleId: string,
): { x: number; y: number } | null {
  const internal = store.getState().nodeInternals.get(sourceNodeId) as any;
  if (!internal) return null;

  const handles = internal[internalsSymbol]?.handleBounds?.source as
    | Array<{ id?: string; x: number; y: number; width: number; height: number }>
    | undefined;
  if (!handles?.length) return null;

  const h = handles.find((hb) => hb.id === sourceHandleId) ?? handles[0];
  const srcP = internal[internalsSymbol]?.positionAbsolute ?? internal.positionAbsolute;
  if (srcP == null || typeof srcP.x !== 'number' || typeof srcP.y !== 'number') return null;

  return {
    x: srcP.x + h.x + h.width / 2,
    y: srcP.y + h.y + h.height / 2,
  };
}
