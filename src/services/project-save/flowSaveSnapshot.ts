// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Helpers for persisting workspace flows: cloning before draft commit (provider remount)
 * and mapping to the shape consumed by ProjectSaveOrchestrator.executeSave.
 */

export type WorkspaceFlowRecord = Record<string, unknown>;

/**
 * Deep-clone workspace flows for persistence (nodes/edges + per-flow fields like meta, hasLocalChanges).
 * First save from draft: commitDraftProject() changes FlowWorkspaceProvider key → remount → FlowStore reset;
 * flowsRef after await is not the user's graph; a snapshot taken before commit is the source of truth.
 */
export function cloneWorkspaceFlowsSnapshot(
  flows: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!flows || typeof flows !== 'object') return {};
  return Object.fromEntries(
    Object.entries(flows).map(([flowId, f]) => {
      const flow = f as Record<string, unknown>;
      const rawNodes = Array.isArray(flow?.nodes) ? (flow.nodes as unknown[]) : [];
      const rawEdges = Array.isArray(flow?.edges) ? (flow.edges as unknown[]) : [];
      let nodes: unknown[] = [];
      let edges: unknown[] = [];
      try {
        nodes = JSON.parse(JSON.stringify(rawNodes)) as unknown[];
        edges = JSON.parse(JSON.stringify(rawEdges)) as unknown[];
      } catch {
        nodes = [...rawNodes];
        edges = [...rawEdges];
      }
      return [
        flowId,
        {
          ...flow,
          nodes,
          edges,
        },
      ];
    })
  );
}

export type FlowsByIdForOrchestrator = Record<
  string,
  {
    nodes: unknown[];
    edges: unknown[];
    meta?: { variables?: unknown[] };
    hasLocalChanges?: boolean;
  }
>;

/**
 * Maps workspace flows to executeSave `flowsById`.
 * If a flow has any nodes or edges, force hasLocalChanges true so stale false (e.g. draft first save)
 * cannot block persistence; empty flows keep explicit hasLocalChanges when provided.
 */
export function buildFlowsByIdForOrchestrator(allFlows: WorkspaceFlowRecord): FlowsByIdForOrchestrator {
  return Object.fromEntries(
    Object.entries(allFlows).map(([fid, raw]) => {
      const f = raw as Record<string, unknown>;
      const nodes = Array.isArray(f?.nodes) ? (f.nodes as unknown[]) : [];
      const edges = Array.isArray(f?.edges) ? (f.edges as unknown[]) : [];
      const hasGraph = nodes.length > 0 || edges.length > 0;
      const hasLocalChanges = hasGraph
        ? true
        : f?.hasLocalChanges !== undefined
          ? Boolean(f.hasLocalChanges)
          : undefined;

      return [
        fid,
        {
          nodes,
          edges,
          ...(f?.meta !== undefined ? { meta: f.meta as { variables?: unknown[] } } : {}),
          ...(hasLocalChanges !== undefined ? { hasLocalChanges } : {}),
        },
      ];
    })
  ) as FlowsByIdForOrchestrator;
}
