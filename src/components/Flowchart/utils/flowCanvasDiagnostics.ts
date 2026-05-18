/**
 * Opt-in flow canvas diagnostics.
 *
 * Minimal (position + drag only):
 *   localStorage.setItem('omnia.flowCanvas.debug', '1'); location.reload();
 *
 * Verbose (viewport, onNodesChange, ephemeral frames):
 *   localStorage.setItem('omnia.flowCanvas.debug', 'verbose'); location.reload();
 */

import type { Node, NodeChange } from 'reactflow';

const LS_KEY = 'omnia.flowCanvas.debug';

let traceSeq = 0;
let bootLogged = false;

export function isFlowCanvasDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = window.localStorage.getItem(LS_KEY);
    return v === '1' || v === 'verbose';
  } catch {
    return false;
  }
}

export function isFlowCanvasDebugVerbose(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LS_KEY) === 'verbose';
  } catch {
    return false;
  }
}

function ensureBootMessage(): void {
  if (bootLogged || !isFlowCanvasDebugEnabled()) return;
  bootLogged = true;
  const mode = isFlowCanvasDebugVerbose() ? 'verbose' : 'minimal';
  console.info(
    `[omnia-flow-canvas] debug ON (${mode}) — logs: shell.*, hydrate.lock.*, resize.*, toolbarDrag.*, commit.*, semantic commits. ` +
      (mode === 'minimal'
        ? 'For viewport/onNodesChange: set localStorage "omnia.flowCanvas.debug" = "verbose". Hydration locks: localStorage "omnia.flowHydrationTrace" = "1".'
        : 'Hydration locks: localStorage "omnia.flowHydrationTrace" = "1".')
  );
}

export function nextFlowCanvasTraceId(prefix = 'tr'): string {
  traceSeq += 1;
  return `${prefix}_${traceSeq}_${Date.now().toString(36)}`;
}

/** Compact position map for logs: `id@(x,y); ...` */
export function summarizeNodePositions(
  nodes: readonly { id: string; position?: { x?: number; y?: number } }[]
): string {
  return nodes
    .map((n) => {
      const p = n.position;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return `${n.id}:?`;
      return `${n.id}@(${p.x.toFixed(1)},${p.y.toFixed(1)})`;
    })
    .join('; ');
}

export function diffNodePositions(
  before: readonly { id: string; position?: { x?: number; y?: number } }[],
  after: readonly { id: string; position?: { x?: number; y?: number } }[]
): Array<{ id: string; from: string; to: string }> {
  const beforeMap = new Map(before.map((n) => [n.id, n.position]));
  const out: Array<{ id: string; from: string; to: string }> = [];
  for (const n of after) {
    const p0 = beforeMap.get(n.id);
    const p1 = n.position;
    const s0 =
      p0 && Number.isFinite(p0.x) && Number.isFinite(p0.y)
        ? `(${p0.x.toFixed(1)},${p0.y.toFixed(1)})`
        : '?';
    const s1 =
      p1 && Number.isFinite(p1.x) && Number.isFinite(p1.y)
        ? `(${p1.x.toFixed(1)},${p1.y.toFixed(1)})`
        : '?';
    if (s0 !== s1) out.push({ id: n.id, from: s0, to: s1 });
  }
  return out;
}

export function flowCanvasDiag(tag: string, data?: Record<string, unknown>): void {
  if (!isFlowCanvasDebugEnabled()) return;
  ensureBootMessage();
  if (!isFlowCanvasDebugVerbose() && tag.startsWith('onNodesChange')) return;
  try {
    console.log(`[omnia-flow-canvas] ${tag}`, data ?? '');
  } catch {
    /* noop */
  }
}

/** Log only when at least one node position changed. */
export function flowCanvasDiagPositions(
  tag: string,
  before: readonly Node[],
  after: readonly Node[],
  extra?: Record<string, unknown>
): void {
  if (!isFlowCanvasDebugEnabled()) return;
  ensureBootMessage();
  const deltas = diffNodePositions(before, after);
  if (deltas.length === 0) return;
  flowCanvasDiag(tag, {
    ...extra,
    deltaCount: deltas.length,
    deltas: deltas.slice(0, 12),
    before: summarizeNodePositions(before),
    after: summarizeNodePositions(after),
  });
}

const SEMANTIC_VERBOSE_TYPES = new Set([
  'VIEWPORT_SETTLED',
  'VIEWPORT_INITIAL_FIT',
  'CANVAS_LAYOUT_SETTLED',
]);

export function flowCanvasDiagSemantic(
  eventType: string,
  flowId: string,
  detail: Record<string, unknown>
): void {
  if (!isFlowCanvasDebugEnabled()) return;
  if (SEMANTIC_VERBOSE_TYPES.has(eventType) && !isFlowCanvasDebugVerbose()) return;
  flowCanvasDiag(`semantic.${eventType}`, { flowId, ...detail });
}

/** Whether onNodesChange is worth logging (verbose mode). */
export function isInterestingNodesChange(changes: readonly NodeChange[]): boolean {
  return changes.some((ch) => {
    if (ch.type === 'position') return true;
    if (ch.type === 'dimensions') return true;
    if (ch.type === 'add' || ch.type === 'remove') return true;
    return false;
  });
}
