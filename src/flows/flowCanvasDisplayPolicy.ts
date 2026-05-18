/**
 * When the flow canvas may mount React Flow (avoid empty→hydrated flash).
 */

import { isFlowLoadInFlight } from './flowLoadCoordinator';
import { isRealProjectId } from './flowHydrationPolicy';

export type FlowCanvasDisplayInput = {
  projectId?: string;
  flowId: string;
  nodeCount: number;
  edgeCount: number;
  hydrated?: boolean;
  serverHydrationApplied?: boolean;
  hasLocalChanges?: boolean;
  isHostLoading?: boolean;
};

/**
 * True when React Flow should mount with the current slice (not a loading placeholder).
 */
export function shouldMountFlowCanvasGraph(input: FlowCanvasDisplayInput): boolean {
  const nodeCount = input.nodeCount ?? 0;
  const edgeCount = input.edgeCount ?? 0;
  const pid = String(input.projectId ?? '').trim();
  const flowId = String(input.flowId || 'main').trim();

  if (nodeCount > 0 || edgeCount > 0) return true;
  if (input.hasLocalChanges === true && nodeCount > 0) return true;

  if (!isRealProjectId(pid)) {
    return true;
  }

  if (input.hydrated === true && input.serverHydrationApplied === true) {
    return true;
  }

  if (input.isHostLoading === true || isFlowLoadInFlight(pid, flowId)) {
    return false;
  }

  if (input.hydrated === true && nodeCount === 0 && edgeCount === 0) {
    return true;
  }

  return false;
}
