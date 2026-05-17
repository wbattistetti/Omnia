/**
 * Persists ElevenLabs KB editor state (snippets, how-to-use) per agent in sessionStorage.
 */

import type { PersistedKbDocument } from './elevenLabsStagedNodeFiles';

export type KbWorkspacePersistState = {
  /** nodeId → uploaded/parsed documents (metadata + editor fields, no File blob). */
  byNodeId: Record<string, PersistedKbDocument[]>;
  /** Agent-level system prompt Markdown (workspace editor). */
  agentSystemPromptMarkdown: string;
};

const EMPTY: KbWorkspacePersistState = {
  byNodeId: {},
  agentSystemPromptMarkdown: '',
};

function storageKey(projectId: string, agentId: string): string {
  return `omnia.elWsKb.v1.${encodeURIComponent(projectId)}.${encodeURIComponent(agentId)}`;
}

const memory = new Map<string, KbWorkspacePersistState>();

function memKey(projectId: string, agentId: string): string {
  return `${projectId.trim()}\x1e${agentId.trim()}`;
}

export function getKbWorkspacePersist(
  projectId: string | undefined,
  agentId: string
): KbWorkspacePersistState {
  const pid = String(projectId || '').trim();
  const aid = String(agentId || '').trim();
  if (!aid) return { ...EMPTY, byNodeId: {} };
  const key = pid ? memKey(pid, aid) : aid;
  const hit = memory.get(key);
  if (hit) return hit;
  if (!pid || typeof sessionStorage === 'undefined') return { ...EMPTY, byNodeId: {} };
  try {
    const raw = sessionStorage.getItem(storageKey(pid, aid));
    if (!raw) return { ...EMPTY, byNodeId: {} };
    const parsed = JSON.parse(raw) as KbWorkspacePersistState;
    const state: KbWorkspacePersistState = {
      byNodeId: parsed?.byNodeId && typeof parsed.byNodeId === 'object' ? parsed.byNodeId : {},
      agentSystemPromptMarkdown:
        typeof parsed?.agentSystemPromptMarkdown === 'string'
          ? parsed.agentSystemPromptMarkdown
          : '',
    };
    memory.set(key, state);
    return state;
  } catch {
    return { ...EMPTY, byNodeId: {} };
  }
}

export function setKbWorkspacePersist(
  projectId: string | undefined,
  agentId: string,
  state: KbWorkspacePersistState
): void {
  const pid = String(projectId || '').trim();
  const aid = String(agentId || '').trim();
  if (!aid) return;
  const key = pid ? memKey(pid, aid) : aid;
  memory.set(key, state);
  if (!pid || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(pid, aid), JSON.stringify(state));
  } catch {
    /* quota */
  }
}
