/**
 * Incremental migration toward FlowStore-led structural graph mutations.
 *
 * Phase 1: DEV warnings flag non-central writes (grep: `[FlowGraph:migration]`).
 * Phase 4+: flip flags via env to disable legacy bypasses one at a time (see docs/FLOW_GRAPH_CONTRACT.md).
 */

/** Read Vite env with safe default — unset = feature off (legacy path stays active). */
function viteFlag(key: string): boolean {
  try {
    const v = (import.meta.env as Record<string, string | undefined>)[key];
    return String(v ?? '').trim() === '1';
  } catch {
    return false;
  }
}

export const FLOW_GRAPH_MIGRATION = {
  /** Phase 1: console.warn when code paths mutate graph structure outside orchestrator-led FlowStore updates. */
  WARN_LOCAL_GRAPH_MUTATION:
    import.meta.env.DEV && !viteFlag('VITE_FLOW_GRAPH_SILENCE_LOCAL_WARNINGS'),

  /** Phase 4 — CustomNode optimistic merge after crossNodeRowMove (bubble listener). */
  DISABLE_OPTIMISTIC_CROSS_NODE_MERGE: viteFlag('VITE_FLOW_GRAPH_DISABLE_OPTIMISTIC_MERGE'),

  /** Phase 4 — orchestrator scheduling post-commit RF row patch. */
  DISABLE_SCHEDULE_COMMITTED_FLOW_NODE_ROWS_SYNC: viteFlag(
    'VITE_FLOW_GRAPH_DISABLE_SCHEDULE_COMMITTED_SYNC'
  ),

  /** Phase 4 — FlowCanvasHost listener applying COMMITTED_FLOW_NODE_ROWS_SYNC_EVENT. */
  DISABLE_COMMITTED_FLOW_NODE_ROWS_LISTENER: viteFlag(
    'VITE_FLOW_GRAPH_DISABLE_COMMITTED_ROWS_LISTENER'
  ),

  /** Reserved: local row-list overlay (disabled; canvas uses store + `updateFlowGraph` in viewer-only). */
  DISABLE_NODE_ROW_EXTERNAL_SYNC_DERIVE: viteFlag(
    'VITE_FLOW_GRAPH_DISABLE_EXTERNAL_ROW_DERIVE'
  ),
} as const;

/**
 * Warn when structural graph state is mutated from UI / helpers instead of the single orchestrator pipeline.
 * Suppress wholesale with `VITE_FLOW_GRAPH_SILENCE_LOCAL_WARNINGS` in `.env.local` during noisy phases.
 */
export function warnLocalGraphMutation(site: string, detail?: Record<string, unknown>): void {
  if (!FLOW_GRAPH_MIGRATION.WARN_LOCAL_GRAPH_MUTATION) return;
  console.warn(
    `[FlowGraph:migration] Non-central graph write path (${site}). Target: FlowStore + structural commands only.`,
    detail ?? {}
  );
}

/**
 * Opt-in routing diagnostics for DnD → command kind (default off; enable `VITE_FLOW_GRAPH_DND_ROUTING_LOG=1`).
 */
export function logDndRouting(label: string, payload?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (!viteFlag('VITE_FLOW_GRAPH_DND_ROUTING_LOG')) return;
  if (payload !== undefined) {
    console.log(`[FlowGraph:dnd] ${label}`, payload);
  } else {
    console.log(`[FlowGraph:dnd] ${label}`);
  }
}
