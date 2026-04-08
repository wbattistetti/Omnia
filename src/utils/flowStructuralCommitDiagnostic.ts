/**
 * Diagnostic-only logging for flowsNext → FlowStore commit path (StructuralOrchestrator + upsert).
 * Does not alter merge behaviour.
 */

import type { Flow, WorkspaceState } from '@flows/FlowTypes';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';

function collectRowIdSampleFromNodes(nodes: unknown[] | undefined, maxIds: number): string[] {
  const out: string[] = [];
  if (!Array.isArray(nodes)) return out;
  for (const node of nodes) {
    const rows = (node as { data?: { rows?: { id?: string }[] } })?.data?.rows;
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      const id = String((r as { id?: string })?.id || '').trim();
      if (id) out.push(id);
      if (out.length >= maxIds) return out;
    }
  }
  return out;
}

/** Call immediately before `commitFlowSlices(flowsNext, flowIds)` in StructuralOrchestrator. */
export function logStructuralOrchestratorCommitSnapshot(
  label: string,
  flowsNext: WorkspaceState['flows'],
  flowIds: string[]
): void {
  for (const flowId of flowIds) {
    const slice = flowsNext[flowId] as { nodes?: unknown[] } | undefined;
    const nodes = Array.isArray(slice?.nodes) ? slice!.nodes! : [];
    logTaskSubflowMove(`orchestrator:commitSnapshot:${label}`, {
      flowId,
      slicePresent: Boolean(slice),
      nodeCount: nodes.length,
      rowIdSample: collectRowIdSampleFromNodes(nodes, 3),
    });
  }
}

/** Every inbound flow to FlowStore via subflow sync upsert (DockManager wrapper). */
export function logUpsertFlowSliceInbound(source: string, flow: Flow): void {
  const fid = String(flow.id || '');
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  logTaskSubflowMove(`upsertFlow:inbound:${source}`, {
    flowId: fid,
    isSubflow: fid.startsWith('subflow_'),
    nodeCount: nodes.length,
    rowIdSample: collectRowIdSampleFromNodes(nodes as unknown[], 3),
    emptyNodesExplicit: Array.isArray(flow.nodes) && flow.nodes.length === 0,
  });
}

/** Other callers that upsert with `nodes: []` on a subflow id (destructive if not merged away). */
export function logUpsertSubflowEmptyNodesCaller(
  caller: string,
  flow: Partial<Flow> & { id?: string }
): void {
  const fid = String(flow.id || '');
  const empty = Array.isArray(flow.nodes) && flow.nodes.length === 0;
  if (!fid.startsWith('subflow_') || !empty) return;
  logTaskSubflowMove(`upsertFlow:emptyNodesCaller:${caller}`, {
    flowId: fid,
    nodeCount: 0,
    hydrated: flow.hydrated,
    hasLocalChanges: flow.hasLocalChanges,
  });
}
