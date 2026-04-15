// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * After workspace UI snapshot restore, hydrates open flow slices from the server sequentially so
 * subflow tabs already have graph data when their FlowCanvasHost mounts (avoids strictly serial
 * user-perceived load: dock → tab → fetch).
 */

import { loadFlow } from '@flows/FlowPersistence';
import { explainShouldLoadFlowFromServer } from '@flows/flowHydrationPolicy';
import type { Flow } from '@flows/FlowTypes';
import { resolveFlowTabDisplayTitle } from '@utils/resolveFlowTabDisplayTitle';

export type PrefetchFlowSliceFns = {
  getFlows: () => Record<string, Flow | undefined>;
  upsertFlow: (flow: Flow) => void;
};

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
  fns: PrefetchFlowSliceFns
): Promise<void> {
  const pid = String(projectId || '').trim();
  if (!pid) return;

  for (const flowId of flowIds) {
    const flows = fns.getFlows();
    const slice = flows[flowId];
    if (!shouldPrefetchFlowLoad(pid, slice)) continue;

    try {
      const data = await loadFlow(pid, flowId);
      const flowsAfterDoc = fns.getFlows();
      const title = resolveFlowTabDisplayTitle(flowId, flowsAfterDoc as Record<string, { title?: string } | undefined>);
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
    } catch {
      /* single-flow failure must not block other tabs */
    }
  }
}
