/**
 * Debugger timeline persistence: single pipeline session.steps → debounce → JSON { steps } in localStorage.
 * All reads/writes for this feature go through this module only.
 */
import type { DebuggerStep } from '../core/DebuggerStep';

const STORAGE_PREFIX = 'omnia.debugger.conversation.v1';
const SAVE_DEBOUNCE_MS = 400;

function storageKey(projectId: string, flowId: string): string {
  return `${STORAGE_PREFIX}:${projectId}:${flowId}`;
}

function normalizeIds(
  projectId: string,
  flowId: string
): { pid: string; fid: string; key: string } | null {
  const pid = String(projectId || '').trim();
  const fid = String(flowId || '').trim();
  if (!pid || !fid) return null;
  return { pid, fid, key: JSON.stringify([pid, fid]) };
}

function writeSnapshot(pid: string, fid: string, steps: readonly DebuggerStep[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(pid, fid), JSON.stringify({ steps: [...steps] }));
  } catch {
    /* quota / private mode */
  }
}

type PendingSave = {
  timer: ReturnType<typeof setTimeout>;
  steps: readonly DebuggerStep[];
  pid: string;
  fid: string;
};

const pendingSaves = new Map<string, PendingSave>();

/**
 * Debounced save of steps only. Call from React via a single passive effect.
 */
export function scheduleSaveDebuggerConversation(
  steps: readonly DebuggerStep[],
  projectId: string,
  flowId: string
): void {
  if (typeof localStorage === 'undefined') return;
  const ids = normalizeIds(projectId, flowId);
  if (!ids) return;

  const prev = pendingSaves.get(ids.key);
  if (prev) clearTimeout(prev.timer);

  const { pid, fid, key } = ids;
  const timer = setTimeout(() => {
    pendingSaves.delete(key);
    writeSnapshot(pid, fid, steps);
  }, SAVE_DEBOUNCE_MS);

  pendingSaves.set(key, { timer, steps, pid, fid });
}

/** Cancels every pending debounced save (no write). */
export function cancelPendingDebuggerSave(): void {
  for (const p of pendingSaves.values()) {
    clearTimeout(p.timer);
  }
  pendingSaves.clear();
}

/** Writes all pending payloads immediately. */
export function flushPendingDebuggerSave(): void {
  if (typeof localStorage === 'undefined') return;
  for (const p of pendingSaves.values()) {
    clearTimeout(p.timer);
    writeSnapshot(p.pid, p.fid, p.steps);
  }
  pendingSaves.clear();
}

export function removeDebuggerSnapshot(projectId: string, flowId: string): void {
  if (typeof localStorage === 'undefined') return;
  const ids = normalizeIds(projectId, flowId);
  if (!ids) return;
  try {
    localStorage.removeItem(storageKey(ids.pid, ids.fid));
  } catch {
    /* noop */
  }
}

/**
 * One-shot load at hydration. Returns [] if missing or invalid.
 */
export function loadDebuggerConversation(projectId: string, flowId: string): DebuggerStep[] {
  if (typeof localStorage === 'undefined') return [];
  const ids = normalizeIds(projectId, flowId);
  if (!ids) return [];
  try {
    const raw = localStorage.getItem(storageKey(ids.pid, ids.fid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || !('steps' in parsed)) return [];
    const steps = (parsed as { steps?: unknown }).steps;
    if (!Array.isArray(steps)) return [];
    return steps.map((row: unknown, i: number) => normalizeLoadedStep(row, i));
  } catch {
    return [];
  }
}

function normalizeLoadedStep(row: unknown, i: number): DebuggerStep {
  const r = row as Record<string, unknown>;
  return {
    id: String(r.id ?? `loaded-${i}`),
    clientMessageId: r.clientMessageId != null ? String(r.clientMessageId) : undefined,
    utterance: String(r.utterance ?? ''),
    semanticValue: String(r.semanticValue ?? ''),
    linguisticValue: String(r.linguisticValue ?? ''),
    grammar: {
      type: String((r.grammar as { type?: string } | undefined)?.type ?? 'unknown'),
      contract: String((r.grammar as { contract?: string } | undefined)?.contract ?? ''),
      elapsedMs: Number((r.grammar as { elapsedMs?: number } | undefined)?.elapsedMs ?? 0),
    },
    slotLabel: r.slotLabel != null ? String(r.slotLabel) : undefined,
    activeNodeId: String(r.activeNodeId ?? ''),
    passedNodeIds: Array.isArray(r.passedNodeIds) ? [...(r.passedNodeIds as string[])] : [],
    noMatchNodeIds: Array.isArray(r.noMatchNodeIds) ? [...(r.noMatchNodeIds as string[])] : [],
    activeEdgeId: String(r.activeEdgeId ?? ''),
    botResponse: r.botResponse != null ? String(r.botResponse) : undefined,
    botResponsePlaceholders:
      r.botResponsePlaceholders && typeof r.botResponsePlaceholders === 'object'
        ? (r.botResponsePlaceholders as Record<string, string>)
        : undefined,
    variables:
      r.variables && typeof r.variables === 'object' ? (r.variables as Record<string, unknown>) : undefined,
    note: r.note != null ? String(r.note) : undefined,
    tags: Array.isArray(r.tags) ? [...(r.tags as string[])] : undefined,
  };
}
