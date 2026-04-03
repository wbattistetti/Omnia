/**
 * Opt-in tracing for empty subflow canvas / graph slice issues (portal append, loadFlow, merge).
 *
 * Enable in DevTools:
 *   localStorage.setItem('omnia.subflowCanvasDebug', '1')
 * Disable:
 *   localStorage.removeItem('omnia.subflowCanvasDebug')
 */

const LS_KEY = 'omnia.subflowCanvasDebug';

export function isSubflowCanvasDebugEnabled(): boolean {
  try {
    if (import.meta.env?.DEV && typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY) === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** One log line with a fixed prefix for filtering the console. */
export function logSubflowCanvasDebug(message: string, payload?: Record<string, unknown>): void {
  if (!isSubflowCanvasDebugEnabled()) return;
  if (payload !== undefined) {
    console.log(`[SubflowCanvasDebug] ${message}`, payload);
  } else {
    console.log(`[SubflowCanvasDebug] ${message}`);
  }
}

/** Compact graph summary for logs (node count + row count per node + optional row ids). */
export function summarizeFlowSlice(
  slice: { nodes?: unknown[]; title?: string; hydrated?: boolean; hasLocalChanges?: boolean } | undefined,
  options?: { rowIdsSample?: boolean }
): Record<string, unknown> {
  if (!slice) {
    return { slicePresent: false };
  }
  const nodes = Array.isArray(slice.nodes) ? slice.nodes : [];
  const perNode = nodes.map((n: any, i: number) => {
    const rows = Array.isArray(n?.data?.rows) ? n.data.rows : [];
    const rowIds = rows.map((r: { id?: string }) => String(r?.id || '').trim()).filter(Boolean);
    const sample =
      options?.rowIdsSample && rowIds.length > 0 ? rowIds.slice(0, 5) : undefined;
    return {
      index: i,
      nodeId: String(n?.id ?? '').trim() || '(missing)',
      rowCount: rows.length,
      ...(sample ? { rowIdsSample: sample } : {}),
    };
  });
  return {
    slicePresent: true,
    title: slice.title,
    hydrated: slice.hydrated,
    hasLocalChanges: slice.hasLocalChanges,
    nodeCount: nodes.length,
    perNode,
  };
}
