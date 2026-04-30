// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Opt-in diagnostics for draft save, flow PUT, and reopen hydration.
 * Enable: .env.local VITE_FLOW_SAVE_DEBUG=true, or in DevTools:
 *   localStorage.setItem('omnia.flowSaveDebug', '1')
 * Disable: localStorage.removeItem('omnia.flowSaveDebug')
 *
 * `FlowCanvasHost: skip server loadFlow` is throttled (10s per projectId+flowId+reason) when
 * flowSaveDebug is enabled — the hydration effect can fire twice in quick succession (e.g. graph + row update).
 */

const LS_KEY = 'omnia.flowSaveDebug';

export function isFlowSaveDebugEnabled(): boolean {
  try {
    if (import.meta.env?.VITE_FLOW_SAVE_DEBUG === 'true') return true;
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** High-frequency React effect paths log the same "skip loadFlow" line many times per second. */
const SKIP_SERVER_LOADFLOW_THROTTLE_MS = 10_000;
const lastSkipServerLoadFlowLogAt = new Map<string, number>();

export function logFlowSaveDebug(message: string, payload?: Record<string, unknown>): void {
  if (!isFlowSaveDebugEnabled()) return;

  if (message === 'FlowCanvasHost: skip server loadFlow' && payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const key = `${String(p.projectId ?? '')}:${String(p.flowId ?? '')}:${String(p.reason ?? '')}`;
    const now = Date.now();
    const prev = lastSkipServerLoadFlowLogAt.get(key) ?? 0;
    if (now - prev < SKIP_SERVER_LOADFLOW_THROTTLE_MS) return;
    lastSkipServerLoadFlowLogAt.set(key, now);
  }

  if (payload !== undefined) {
    console.log(`[FlowSaveDebug] ${message}`, payload);
  } else {
    console.log(`[FlowSaveDebug] ${message}`);
  }
}

export type FlowSnapshotSummary = {
  flowIds: string[];
  perFlow: Array<{
    flowId: string;
    nodeCount: number;
    edgeCount: number;
    hydrated?: unknown;
    hasLocalChanges?: unknown;
  }>;
};

/** Compact view of workspace flows for console (save path). */
export function summarizeWorkspaceFlowsForDebug(
  flows: Record<string, unknown> | undefined | null
): FlowSnapshotSummary {
  if (!flows || typeof flows !== 'object') {
    return { flowIds: [], perFlow: [] };
  }
  const flowIds = Object.keys(flows);
  const perFlow = flowIds.map((flowId) => {
    const f = flows[flowId] as Record<string, unknown> | undefined;
    const nodes = f?.nodes;
    const edges = f?.edges;
    const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
    const edgeCount = Array.isArray(edges) ? edges.length : 0;
    return {
      flowId,
      nodeCount,
      edgeCount,
      hydrated: f?.hydrated,
      hasLocalChanges: f?.hasLocalChanges,
    };
  });
  return { flowIds, perFlow };
}
