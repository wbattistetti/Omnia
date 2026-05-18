/**
 * Gates React Flow mount until the workspace slice is safe to display (no empty→hydrated flash).
 */

import { useMemo } from 'react';
import { shouldMountFlowCanvasGraph } from '@flows/flowCanvasDisplayPolicy';
import { isFlowLoadInFlight } from '@flows/flowLoadCoordinator';
import { isRealProjectId } from '@flows/flowHydrationPolicy';

export type UseFlowCanvasGraphReadyArgs = {
  flowId: string;
  projectId?: string;
  nodeCount: number;
  edgeCount: number;
  hydrated?: boolean;
  serverHydrationApplied?: boolean;
  hasLocalChanges?: boolean;
  isHostLoading?: boolean;
};

export function useFlowCanvasGraphReady({
  flowId,
  projectId,
  nodeCount,
  edgeCount,
  hydrated,
  serverHydrationApplied,
  hasLocalChanges,
  isHostLoading,
}: UseFlowCanvasGraphReadyArgs): boolean {
  return useMemo(() => {
    const pid = String(projectId ?? '').trim();
    const fid = String(flowId || 'main').trim();
    const inFlight =
      isHostLoading === true || (isRealProjectId(pid) && isFlowLoadInFlight(pid, fid));
    return shouldMountFlowCanvasGraph({
      projectId: pid || undefined,
      flowId: fid,
      nodeCount,
      edgeCount,
      hydrated,
      serverHydrationApplied,
      hasLocalChanges,
      isHostLoading: inFlight,
    });
  }, [
    flowId,
    projectId,
    nodeCount,
    edgeCount,
    hydrated,
    serverHydrationApplied,
    hasLocalChanges,
    isHostLoading,
  ]);
}
