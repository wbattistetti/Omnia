/**
 * Picks the fresher flow slice when the caller's workspace snapshot may lag FlowStore
 * (structural DnD + variable hydration in the same tick).
 */

import type { WorkspaceState } from '@flows/FlowTypes';

export function totalTaskRowCountInFlowSlice(flow: { nodes?: unknown[] } | undefined): number {
  if (!flow?.nodes?.length) return 0;
  let n = 0;
  for (const node of flow.nodes as Array<{ data?: { rows?: unknown[] } }>) {
    const rows = node?.data?.rows;
    if (Array.isArray(rows)) n += rows.length;
  }
  return n;
}

/**
 * Per flow id, keeps the slice with the higher total task-row count (ties → live / second arg wins).
 */
export function mergeWorkspaceFlowsPreferRicherGraph(
  paramFlows: WorkspaceState['flows'] | null | undefined,
  liveFlows: WorkspaceState['flows'] | null | undefined
): WorkspaceState['flows'] {
  const p = paramFlows && typeof paramFlows === 'object' ? paramFlows : {};
  const l = liveFlows && typeof liveFlows === 'object' ? liveFlows : {};
  const ids = new Set([...Object.keys(p), ...Object.keys(l)]);
  const out: WorkspaceState['flows'] = {};
  for (const fid of ids) {
    const ps = p[fid];
    const ls = l[fid];
    if (!ps) {
      if (ls) out[fid] = ls;
      continue;
    }
    if (!ls) {
      out[fid] = ps;
      continue;
    }
    const cL = totalTaskRowCountInFlowSlice(ls as { nodes?: unknown[] });
    const cP = totalTaskRowCountInFlowSlice(ps as { nodes?: unknown[] });
    out[fid] = cL >= cP ? ls : ps;
  }
  return out;
}
