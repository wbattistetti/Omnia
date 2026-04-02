/**
 * Stable fingerprint for flow canvas rows (all flows). Used to re-run utterance variable
 * hydration when the workspace graph changes, without depending on object identity.
 */
import type { WorkspaceState } from '../flows/FlowTypes';

export function buildFlowCanvasRowFingerprint(
  flows: WorkspaceState['flows'] | null | undefined
): string {
  if (!flows) return '';
  const parts: string[] = [];
  for (const flowId of Object.keys(flows).sort()) {
    const nodes = flows[flowId]?.nodes;
    if (!Array.isArray(nodes)) continue;
    for (const node of nodes) {
      const rows = (node as { data?: { rows?: unknown[] } })?.data?.rows;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const id = String((row as { id?: string }).id || '').trim();
        if (!id) continue;
        const inc = (row as { included?: boolean }).included !== false;
        parts.push(`${flowId}\x1e${id}\x1e${inc}`);
      }
    }
  }
  return parts.sort().join('\x1f');
}
