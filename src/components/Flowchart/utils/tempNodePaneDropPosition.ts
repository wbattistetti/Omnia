/**
 * Calcola posizione top-left del nodo temporaneo al rilascio sul pane durante una connessione.
 * Snap alla colonna/riga dell'handle sorgente quando il mouse è vicino all'asse e dal lato atteso
 * (sotto/sopra/destra/sinistra), con tolleranza schermo sensibile allo zoom.
 */

import type { Node } from 'reactflow';
import type { FlowNode } from '../types/flowTypes';
import { getSourceHandleCenterInFlow } from './sourceHandleCenterInFlow';
import type { ReactFlowStoreLike } from './waitForHandleBounds';

const FLOW_SIDE_SLACK = 4;

export type TempNodePaneDropPositionResult = {
  position: { x: number; y: number };
  /** Snap X all'asse dell'handle (bottom/top). */
  verticalColumnDrop: boolean;
  /** Snap Y all'asse dell'handle (left/right). */
  horizontalRowDrop: boolean;
};

function readZoom(reactFlowInstance: { getZoom?: () => number; getViewport?: () => { zoom?: number } }): number {
  try {
    if (typeof reactFlowInstance.getZoom === 'function') {
      return Math.max(0.08, reactFlowInstance.getZoom());
    }
    const z = reactFlowInstance.getViewport?.()?.zoom;
    return Math.max(0.08, typeof z === 'number' ? z : 1);
  } catch {
    return 1;
  }
}

/**
 * Tolleranza in pixel schermo: ampia abbastanza da colpire la colonna sotto il nodo;
 * scala con la dimensione del nodo in schermo.
 */
export function paneDropScreenAxisTolerancePx(nodeSizeFlow: number, zoom: number): number {
  const sizeScreen = Math.max(80, nodeSizeFlow * zoom);
  return Math.max(40, Math.min(110, sizeScreen * 0.32));
}

/** Handle target opposto all'handle sorgente (stesso mapping di useFlowConnect). */
export function targetHandleIdForTempEdge(sourceHandleId: string): string {
  switch (sourceHandleId) {
    case 'bottom':
      return 'top-target';
    case 'top':
      return 'bottom-target';
    case 'left':
      return 'right-target';
    case 'right':
      return 'left-target';
    default:
      return 'top-target';
  }
}

export function theoreticalHandleCenterFlow(
  sourceNode: Node<FlowNode>,
  sw: number,
  sh: number,
  sourceHandleId: string,
): { x: number; y: number } {
  const px = sourceNode.position.x;
  const py = sourceNode.position.y;
  switch (sourceHandleId) {
    case 'top':
      return { x: px + sw / 2, y: py };
    case 'bottom':
      return { x: px + sw / 2, y: py + sh };
    case 'left':
      return { x: px, y: py + sh / 2 };
    case 'right':
      return { x: px + sw, y: py + sh / 2 };
    default:
      return { x: px + sw / 2, y: py + sh };
  }
}

export function computeTempNodePaneDropPosition(params: {
  clientX: number;
  clientY: number;
  posFlow: { x: number; y: number };
  sourceNode: Node<FlowNode>;
  sourceNodeId: string;
  sourceHandleId: string;
  storeApi: ReactFlowStoreLike;
  reactFlowInstance: {
    flowToScreenPosition?: (p: { x: number; y: number }) => { x: number; y: number };
    getZoom?: () => number;
    getViewport?: () => { zoom?: number };
  };
  realNodeWidth: number;
  realNodeHeight: number;
}): TempNodePaneDropPositionResult {
  const {
    clientX,
    clientY,
    posFlow,
    sourceNode,
    sourceNodeId,
    sourceHandleId,
    storeApi,
    reactFlowInstance,
    realNodeWidth,
    realNodeHeight,
  } = params;

  const sw = sourceNode.measured?.width ?? sourceNode.width ?? 220;
  const sh = sourceNode.measured?.height ?? sourceNode.height ?? 80;
  const measuredSourceCenter = getSourceHandleCenterInFlow(storeApi, sourceNodeId, sourceHandleId);
  const sourceCenterFlow =
    measuredSourceCenter ?? theoreticalHandleCenterFlow(sourceNode, sw, sh, sourceHandleId);

  const zoom = readZoom(reactFlowInstance);
  const toScreen = reactFlowInstance.flowToScreenPosition;
  const hScreen =
    typeof toScreen === 'function' ? toScreen.call(reactFlowInstance, sourceCenterFlow) : null;

  let verticalColumnDrop = false;
  let horizontalRowDrop = false;

  if (hScreen) {
    if (sourceHandleId === 'bottom') {
      const tolX = paneDropScreenAxisTolerancePx(sw, zoom);
      const inColumn = Math.abs(clientX - hScreen.x) <= tolX;
      const belowHandle = posFlow.y >= sourceCenterFlow.y - FLOW_SIDE_SLACK;
      verticalColumnDrop = inColumn && belowHandle;
    } else if (sourceHandleId === 'top') {
      const tolX = paneDropScreenAxisTolerancePx(sw, zoom);
      const inColumn = Math.abs(clientX - hScreen.x) <= tolX;
      const aboveHandle = posFlow.y <= sourceCenterFlow.y + FLOW_SIDE_SLACK;
      verticalColumnDrop = inColumn && aboveHandle;
    } else if (sourceHandleId === 'right') {
      const tolY = paneDropScreenAxisTolerancePx(sh, zoom);
      const inRow = Math.abs(clientY - hScreen.y) <= tolY;
      const toTheRight = posFlow.x >= sourceCenterFlow.x - FLOW_SIDE_SLACK;
      horizontalRowDrop = inRow && toTheRight;
    } else if (sourceHandleId === 'left') {
      const tolY = paneDropScreenAxisTolerancePx(sh, zoom);
      const inRow = Math.abs(clientY - hScreen.y) <= tolY;
      const toTheLeft = posFlow.x <= sourceCenterFlow.x + FLOW_SIDE_SLACK;
      horizontalRowDrop = inRow && toTheLeft;
    }
  }

  const anchorCenterX = verticalColumnDrop ? sourceCenterFlow.x : posFlow.x;
  const anchorTopY =
    horizontalRowDrop ? sourceCenterFlow.y - realNodeHeight / 2 : posFlow.y;

  const position = {
    x: anchorCenterX - realNodeWidth / 2,
    y: anchorTopY,
  };

  return { position, verticalColumnDrop, horizontalRowDrop };
}
