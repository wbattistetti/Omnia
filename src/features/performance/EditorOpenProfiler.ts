/**
 * Lightweight runtime profiler for the "open task editor" hot path.
 * Disabled by default; enable with localStorage key `omnia:perfEditorOpen=1`.
 */
export type EditorOpenMetricName =
  | 'conditionCodeConverter.labelsToGuids'
  | 'conditionCodeConverter.guidsToLabels'
  | 'conditionCodeConverter.labelsToGuids.missingVariable'
  | 'flowCanvasHost.hydrateVariablesFromFlow.effect'
  | 'variableCreationService.hydrateVariablesFromFlow'
  | 'flowCanvasHost.upsertFlow'
  | 'flowCanvasHost.applyFlowLoadResult'
  | 'flowEditor.mount';

type MetricStat = {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
};

const stats = new Map<EditorOpenMetricName, MetricStat>();

function isEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('omnia:perfEditorOpen') === '1';
  } catch {
    return false;
  }
}

function ensureMetric(name: EditorOpenMetricName): MetricStat {
  const existing = stats.get(name);
  if (existing) return existing;
  const created: MetricStat = { count: 0, totalMs: 0, maxMs: 0, lastMs: 0 };
  stats.set(name, created);
  return created;
}

function attachSnapshotToWindow(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __omniaEditorPerf?: Record<string, MetricStat> }).__omniaEditorPerf = Object.fromEntries(
    Array.from(stats.entries()).map(([k, v]) => [
      k,
      { ...v },
    ]),
  );
}

/** Increments call count for a hot-path metric. */
export function incrementEditorOpenMetric(name: EditorOpenMetricName): void {
  if (!isEnabled()) return;
  const s = ensureMetric(name);
  s.count += 1;
  attachSnapshotToWindow();
}

/** Measures elapsed time for a synchronous hot-path function. */
export function measureEditorOpenMetric<T>(name: EditorOpenMetricName, fn: () => T): T {
  if (!isEnabled()) return fn();
  const started = performance.now();
  try {
    return fn();
  } finally {
    const elapsed = performance.now() - started;
    const s = ensureMetric(name);
    s.count += 1;
    s.totalMs += elapsed;
    s.lastMs = elapsed;
    if (elapsed > s.maxMs) s.maxMs = elapsed;
    attachSnapshotToWindow();
  }
}
