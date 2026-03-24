// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Opt-in diagnostics for draft save, flow PUT, and reopen hydration.
 * Enable: .env.local VITE_FLOW_SAVE_DEBUG=true, or in DevTools:
 *   localStorage.setItem('omnia.flowSaveDebug', '1')
 * Disable: localStorage.removeItem('omnia.flowSaveDebug')
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

export function logFlowSaveDebug(message: string, payload?: Record<string, unknown>): void {
  if (!isFlowSaveDebugEnabled()) return;
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
