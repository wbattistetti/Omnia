/**
 * Resolves the child flow canvas id for a Subflow-type task (task.flowId or parameters.flowId).
 */

export function resolveChildFlowIdFromTask(task: unknown): string | null {
  const t = task as { flowId?: string; parameters?: Array<{ parameterId?: string; value?: unknown }> };
  const direct = String(t?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(t?.parameters) ? t.parameters : [];
  const fromParam = params.find((p) => String(p?.parameterId || '').trim() === 'flowId');
  return String(fromParam?.value || '').trim() || null;
}

/**
 * Reads a persisted child flow id from canvas row metadata when the task store is not yet available.
 * Keys are best-effort; authoring may add more over time.
 */
export function resolveChildFlowIdFromCanvasRow(row: unknown): string | null {
  const r = row as { meta?: Record<string, unknown> };
  const m = r.meta;
  if (!m || typeof m !== 'object') return null;
  for (const k of ['flowId', 'childFlowId', 'embeddedFlowId'] as const) {
    const v = m[k];
    const s = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
    if (s) return s;
  }
  return null;
}
