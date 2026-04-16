/**
 * Minimal persistence for debugger steps (localStorage). No scores / failed attempts.
 */
import {
  DEBUGGER_STEP_SCHEMA_VERSION,
  type DebuggerConversationSnapshot,
  type DebuggerStep,
} from '../core/DebuggerStep';

const STORAGE_PREFIX = 'omnia.debugger.conversation.v1';

function storageKey(projectId: string, flowId: string): string {
  return `${STORAGE_PREFIX}:${projectId}:${flowId}`;
}

export function saveDebuggerConversation(
  projectId: string,
  flowId: string,
  steps: readonly DebuggerStep[]
): void {
  if (typeof localStorage === 'undefined') return;
  const pid = String(projectId || '').trim();
  const fid = String(flowId || '').trim();
  if (!pid || !fid) return;
  const snapshot: DebuggerConversationSnapshot = {
    schemaVersion: DEBUGGER_STEP_SCHEMA_VERSION,
    flowId: fid,
    projectId: pid,
    savedAt: new Date().toISOString(),
    steps: steps.map((s) => ({
      ...s,
      id: s.id,
    })),
  };
  try {
    localStorage.setItem(storageKey(pid, fid), JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

export function loadDebuggerConversation(projectId: string, flowId: string): DebuggerStep[] | null {
  if (typeof localStorage === 'undefined') return null;
  const pid = String(projectId || '').trim();
  const fid = String(flowId || '').trim();
  if (!pid || !fid) return null;
  try {
    const raw = localStorage.getItem(storageKey(pid, fid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DebuggerConversationSnapshot;
    if (parsed.schemaVersion !== DEBUGGER_STEP_SCHEMA_VERSION || !Array.isArray(parsed.steps)) {
      return null;
    }
    return parsed.steps.map((row, i) => ({
      id: row.id || `loaded-${i}`,
      clientMessageId: row.clientMessageId,
      utterance: String(row.utterance ?? ''),
      semanticValue: String(row.semanticValue ?? ''),
      linguisticValue: String(row.linguisticValue ?? ''),
      grammar: {
        type: String(row.grammar?.type ?? 'unknown'),
        contract: String(row.grammar?.contract ?? ''),
        elapsedMs: Number(row.grammar?.elapsedMs ?? 0),
      },
      slotLabel: row.slotLabel != null ? String(row.slotLabel) : undefined,
      activeNodeId: String(row.activeNodeId ?? ''),
      passedNodeIds: Array.isArray(row.passedNodeIds) ? [...row.passedNodeIds] : [],
      noMatchNodeIds: Array.isArray(row.noMatchNodeIds) ? [...row.noMatchNodeIds] : [],
      activeEdgeId: String(row.activeEdgeId ?? ''),
      botResponse: row.botResponse,
      botResponsePlaceholders: row.botResponsePlaceholders,
      variables: row.variables,
      note: row.note,
      tags: row.tags,
    }));
  } catch {
    return null;
  }
}

export function clearDebuggerConversation(projectId: string, flowId: string): void {
  if (typeof localStorage === 'undefined') return;
  const pid = String(projectId || '').trim();
  const fid = String(flowId || '').trim();
  if (!pid || !fid) return;
  try {
    localStorage.removeItem(storageKey(pid, fid));
  } catch {
    /* noop */
  }
}
