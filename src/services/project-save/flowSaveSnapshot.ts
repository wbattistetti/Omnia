// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Helpers for persisting workspace flows: cloning before draft commit (provider remount)
 * and mapping to the shape consumed by ProjectSaveOrchestrator.executeSave.
 */

/**
 * When commitDraftProject() runs, FlowWorkspaceProvider remounts (key = projectId) and the
 * in-memory graph is lost. FlowCanvasHost then fetch-loads the server before the save PUT
 * completes, applies an empty graph, and sets hydrated — wiping the user's canvas.
 *
 * After commit returns a real `projectId`, persist the pre-commit snapshot (memory + sessionStorage).
 * FlowWorkspaceProvider calls takeWorkspaceRestoreForProjectOnce in useLayoutEffect (memory first,
 * then session for React Strict second mount). Cleared after orchestrator save succeeds.
 */
export type WorkspaceFlowRecord = Record<string, unknown>;

function workspaceRestoreStorageKey(projectId: string): string {
  return `omnia.flowWorkspaceRestore.${encodeURIComponent(projectId)}`;
}

/** Call immediately after commitDraftProject() succeeds, before refreshData. */
export function persistWorkspaceRestoreForProject(projectId: string, snapshot: WorkspaceFlowRecord): void {
  const pid = String(projectId || '').trim();
  if (!pid || pid.startsWith('draft_')) return;
  if (!snapshot || typeof snapshot !== 'object') return;
  pendingWorkspaceRestoreByProjectId[pid] = snapshot;
  try {
    sessionStorage.setItem(workspaceRestoreStorageKey(pid), JSON.stringify(snapshot));
  } catch {
    /* private mode / quota */
  }
}

/**
 * In-memory queue for the first consume after persist; sessionStorage holds a copy for React Strict
 * Mode's second mount (first take clears memory only). Third path: reload with memory empty reads session.
 */
const pendingWorkspaceRestoreByProjectId: Record<string, WorkspaceFlowRecord> = {};

/**
 * Prefer in-memory pending for this projectId, then sessionStorage (read-once removes session row).
 * Call once per FlowWorkspaceProvider mount path (useLayoutEffect).
 */
export function takeWorkspaceRestoreForProjectOnce(projectId: string): WorkspaceFlowRecord | null {
  const pid = String(projectId || '').trim();
  if (!pid || pid.startsWith('draft_')) return null;
  if (Object.prototype.hasOwnProperty.call(pendingWorkspaceRestoreByProjectId, pid)) {
    const s = pendingWorkspaceRestoreByProjectId[pid];
    delete pendingWorkspaceRestoreByProjectId[pid];
    return s;
  }
  try {
    const raw = sessionStorage.getItem(workspaceRestoreStorageKey(pid));
    if (!raw) return null;
    sessionStorage.removeItem(workspaceRestoreStorageKey(pid));
    return JSON.parse(raw) as WorkspaceFlowRecord;
  } catch {
    return null;
  }
}

/** Call after orchestrator save succeeds so the next open loads from the API, not a stale restore queue. */
export function clearWorkspaceRestoreForProject(projectId: string): void {
  const pid = String(projectId || '').trim();
  if (!pid) return;
  delete pendingWorkspaceRestoreByProjectId[pid];
  try {
    sessionStorage.removeItem(workspaceRestoreStorageKey(pid));
  } catch {
    /* ignore */
  }
}

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
