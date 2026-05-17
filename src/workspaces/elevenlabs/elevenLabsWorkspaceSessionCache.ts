/**
 * In-memory + sessionStorage cache for loaded ElevenLabs agent snapshots (survives dock tab switches).
 */

import type { WorkspaceAgentSnapshot } from '../core/types';
import type { ElevenLabsWorkspaceTab } from '../../components/workspaces/elevenlabs/elevenLabsWorkspaceTabs';

export type ElevenLabsWorkspaceSessionEntry = {
  snapshot: WorkspaceAgentSnapshot;
  selectedNodeId: string | null;
  workspaceTab: ElevenLabsWorkspaceTab;
  fetchedAt: number;
};

const memory = new Map<string, ElevenLabsWorkspaceSessionEntry>();

function cacheKey(projectId: string, agentId: string): string {
  return `${projectId.trim()}\x1e${agentId.trim()}`;
}

function storageKey(projectId: string, agentId: string): string {
  return `omnia.elWsSession.v1.${encodeURIComponent(projectId)}.${encodeURIComponent(agentId)}`;
}

export function getElevenLabsWorkspaceSession(
  projectId: string | undefined,
  agentId: string
): ElevenLabsWorkspaceSessionEntry | null {
  const pid = String(projectId || '').trim();
  const aid = String(agentId || '').trim();
  if (!aid) return null;
  const memKey = pid ? cacheKey(pid, aid) : aid;
  const hit = memory.get(memKey);
  if (hit) return hit;
  if (!pid || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(pid, aid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ElevenLabsWorkspaceSessionEntry;
    if (!parsed?.snapshot?.workflow) return null;
    memory.set(memKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function setElevenLabsWorkspaceSession(
  projectId: string | undefined,
  agentId: string,
  entry: Omit<ElevenLabsWorkspaceSessionEntry, 'fetchedAt'> & { fetchedAt?: number }
): void {
  const pid = String(projectId || '').trim();
  const aid = String(agentId || '').trim();
  if (!aid) return;
  const full: ElevenLabsWorkspaceSessionEntry = {
    ...entry,
    fetchedAt: entry.fetchedAt ?? Date.now(),
  };
  const memKey = pid ? cacheKey(pid, aid) : aid;
  memory.set(memKey, full);
  if (!pid || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(pid, aid), JSON.stringify(full));
  } catch {
    /* quota */
  }
}

export function clearElevenLabsWorkspaceSession(projectId: string, agentId: string): void {
  const pid = String(projectId || '').trim();
  const aid = String(agentId || '').trim();
  if (!pid || !aid) return;
  memory.delete(cacheKey(pid, aid));
  try {
    sessionStorage.removeItem(storageKey(pid, aid));
  } catch {
    /* ignore */
  }
}
