// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * After workspace UI snapshot restore, hydrates open flow slices from the server sequentially so
 * subflow tabs already have graph data when their FlowCanvasHost mounts (avoids strictly serial
 * user-perceived load: dock → tab → fetch).
 */

import { loadFlow } from '@flows/FlowPersistence';
import { explainShouldLoadFlowFromServer } from '@flows/flowHydrationPolicy';
import {
  beginFlowLoad,
  endFlowLoad,
  fingerprintFlowLoadPayload,
  markFlowLoadResultApplied,
  shouldApplyFlowLoadResult,
} from '@flows/flowLoadCoordinator';
import { flowCanvasDiag } from '../components/Flowchart/utils/flowCanvasDiagnostics';
import type { Flow } from '@flows/FlowTypes';
import { FlowStateBridge } from '@services/FlowStateBridge';
import { resolveFlowTabDisplayTitle } from '@utils/resolveFlowTabDisplayTitle';

export type PrefetchFlowSliceFns = {
  getFlows: () => Record<string, Flow | undefined>;
  upsertFlow: (flow: Flow) => void;
};

export type PrefetchFlowSliceOptions = {
  /**
   * When true, a newer prefetch generation superseded this run (StrictMode re-mount).
   * Never drops upsert while the slice graph is still empty — that caused blank canvases.
   */
  isSuperseded?: () => boolean;
};

function sliceGraphIsEmpty(slice: Flow | undefined): boolean {
  return (slice?.nodes?.length ?? 0) === 0 && (slice?.edges?.length ?? 0) === 0;
}

function shouldPrefetchFlowLoad(projectId: string, slice: Flow | undefined): boolean {
  const pid = String(projectId || '').trim();
  if (!pid) return false;
  if (!slice) return true;
  return explainShouldLoadFlowFromServer(pid, slice).shouldLoad;
}

/**
 * For each flow id, loads from server when the slice is missing or {@link explainShouldLoadFlowFromServer}
 * requests a fetch, then upserts a hydrated slice. Sequential awaits avoid overlapping
 * `applyFlowDocumentToStores` runs inside {@link loadFlow}.
 */
export async function prefetchHydratedFlowSlicesFromServer(
  projectId: string,
  flowIds: string[],
  fns: PrefetchFlowSliceFns,
  opts?: PrefetchFlowSliceOptions
): Promise<void> {
  const pid = String(projectId || '').trim();
  if (!pid) return;

  for (const flowId of flowIds) {
    const flows = fns.getFlows();
    const slice = flows[flowId];
    if (!shouldPrefetchFlowLoad(pid, slice)) continue;
    if (FlowStateBridge.getToolbarDragNodeId()) continue;
    if (slice?.hasLocalChanges === true) continue;
    if (slice?.hydrated === true && (slice.nodes?.length ?? 0) > 0) continue;

    // Share the in-flight lock with FlowCanvasHost: only one caller loads a given flowId at a time.
    if (!beginFlowLoad(pid, flowId, 'prefetch')) continue;

    try {
      const data = await loadFlow(pid, flowId);
      const flowsAfterDoc = fns.getFlows();
      // Re-check after the async await — another caller may have hydrated the slice already.
      const sliceNow = flowsAfterDoc[flowId];
      const superseded = opts?.isSuperseded?.() === true;
      if (superseded && !sliceGraphIsEmpty(sliceNow)) {
        flowCanvasDiag('hydrate.prefetch.skip_upsert', {
          flowId,
          reason: 'superseded_with_graph_in_store',
          sliceNodeCount: sliceNow?.nodes?.length ?? 0,
        });
        continue;
      }
      if (superseded && sliceGraphIsEmpty(sliceNow)) {
        flowCanvasDiag('hydrate.prefetch.upsert', {
          flowId,
          reason: 'superseded_but_slice_still_empty',
          nodes: data.nodes.length,
        });
      }
      const loadPayload = {
        nodes: data.nodes,
        edges: data.edges,
        ...(data.meta !== undefined ? { meta: data.meta } : {}),
        tasks: data.tasks,
        variables: data.variables,
        bindings: data.bindings,
      };
      if (sliceNow?.hydrated === true && (sliceNow.nodes?.length ?? 0) > 0) {
        flowCanvasDiag('hydrate.prefetch.skip_upsert', {
          flowId,
          reason: 'already_hydrated_after_await',
          sliceNodeCount: sliceNow.nodes?.length ?? 0,
          payloadFp: fingerprintFlowLoadPayload(loadPayload),
        });
        continue;
      }
      if (!shouldApplyFlowLoadResult(flowId, loadPayload, sliceNow)) {
        flowCanvasDiag('hydrate.prefetch.skip_upsert', {
          flowId,
          reason: 'identical_fingerprint',
          payloadFp: fingerprintFlowLoadPayload(loadPayload),
        });
        continue;
      }
      const title = resolveFlowTabDisplayTitle(flowId, flowsAfterDoc as Record<string, { title?: string } | undefined>);
      if (!superseded) {
        flowCanvasDiag('hydrate.prefetch.upsert', {
          flowId,
          nodes: data.nodes.length,
          edges: data.edges.length,
        });
      }
      fns.upsertFlow({
        id: flowId,
        title,
        nodes: data.nodes,
        edges: data.edges,
        ...(data.meta !== undefined ? { meta: data.meta } : {}),
        tasks: data.tasks,
        variables: data.variables,
        bindings: data.bindings,
        hydrated: true,
        variablesReady: false,
        hasLocalChanges: false,
        serverHydrationApplied: true,
      } as Flow);
      markFlowLoadResultApplied(flowId, loadPayload);
    } catch {
      /* single-flow failure must not block other tabs */
    } finally {
      endFlowLoad(pid, flowId, 'prefetch');
    }
  }
}
