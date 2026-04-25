/**
 * Calls Omnia ApiServer POST /elevenlabs/createAgent (proxies ElevenLabs ConvAI agents/create).
 * API key stays server-side via ELEVENLABS_API_KEY.
 */

import { agentNameContainsTaskGuid } from '@utils/iaAgentRuntime/convaiAgentDisplayName';

export type CreateConvaiAgentViaOmniaParams = {
  /** Optional label for ElevenLabs agent display name */
  name?: string;
  /**
   * Partial ElevenLabs `conversation_config` merged into Omnia defaults on ApiServer
   * (voice, language, prompt/llm from IA Runtime).
   */
  conversation_config?: Record<string, unknown>;
};

export type CreateConvaiAgentViaOmniaResult = {
  agentId: string;
};

export async function createConvaiAgentViaOmniaServer(
  params?: CreateConvaiAgentViaOmniaParams
): Promise<CreateConvaiAgentViaOmniaResult> {
  const body: Record<string, unknown> = {};
  if (params?.name?.trim()) body.name = params.name.trim();
  if (params?.conversation_config && typeof params.conversation_config === 'object') {
    body.conversation_config = params.conversation_config;
  }

  const res = await fetch('/elevenlabs/createAgent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`createAgent: invalid JSON (${res.status})`);
  }

  if (!res.ok) {
    const details = typeof data.details === 'string' ? data.details : JSON.stringify(data);
    const err = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
    const apiBase =
      typeof data.elevenLabsApiBase === 'string' && data.elevenLabsApiBase.trim().length > 0
        ? data.elevenLabsApiBase.trim()
        : '';
    const baseHint = apiBase ? ` [ElevenLabs API base: ${apiBase}]` : '';
    throw new Error(`${err}${details ? ` — ${details.slice(0, 500)}` : ''}${baseHint}`);
  }

  const agentId = typeof data.agentId === 'string' ? data.agentId.trim() : '';
  if (!agentId) {
    throw new Error('createAgent: response missing agentId');
  }

  return { agentId };
}

export type ConvaiAgentListItem = {
  agentId: string;
  name: string;
};

/**
 * Lista agenti ConvAI (proxy ApiServer → GET ElevenLabs /v1/convai/agents).
 */
export async function listConvaiAgentsViaOmniaServer(params?: {
  pageSize?: number;
  cursor?: string | null;
  /** Filtro nome lato ElevenLabs (es. `__GUID_{uuid}`). */
  search?: string | null;
}): Promise<{ agents: ConvaiAgentListItem[]; nextCursor: string | null; hasMore: boolean }> {
  const q = new URLSearchParams();
  const ps = params?.pageSize ?? 100;
  q.set('page_size', String(Math.min(100, Math.max(1, ps))));
  if (params?.cursor) q.set('cursor', params.cursor);
  if (params?.search?.trim()) q.set('search', params.search.trim());

  const url = `/elevenlabs/agents?${q.toString()}`;
  const res = await fetch(url, { method: 'GET' });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`listAgents: invalid JSON (${res.status})`);
  }
  if (!res.ok) {
    const err = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
    throw new Error(err);
  }
  const agentsRaw = data.agents;
  const agents: ConvaiAgentListItem[] = [];
  if (Array.isArray(agentsRaw)) {
    for (const row of agentsRaw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const agentId =
        typeof o.agent_id === 'string'
          ? o.agent_id.trim()
          : typeof o.agentId === 'string'
            ? o.agentId.trim()
            : '';
      const name = typeof o.name === 'string' ? o.name : '';
      if (agentId) agents.push({ agentId, name });
    }
  }
  const nextCursor =
    typeof data.next_cursor === 'string' && data.next_cursor.trim().length > 0
      ? data.next_cursor.trim()
      : typeof data.nextCursor === 'string' && data.nextCursor.trim().length > 0
        ? data.nextCursor.trim()
        : null;
  const hasMore = data.has_more === true || data.hasMore === true;
  return { agents, nextCursor, hasMore };
}

/** Elimina un agente ConvAI (proxy → DELETE ElevenLabs /v1/convai/agents/{id}). */
export async function deleteConvaiAgentViaOmniaServer(agentId: string): Promise<void> {
  const id = String(agentId || '').trim();
  if (!id) throw new Error('deleteAgent: agentId mancante');
  const res = await fetch(`/elevenlabs/agents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const text = await res.text();
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (typeof j.error === 'string') msg = j.error;
    } catch {
      /* noop */
    }
    throw new Error(`deleteAgent: ${msg}`);
  }
}

/**
 * Raccoglie tutti gli agenti il cui nome contiene il marker `__GUID_{taskGuid}` (paginazione).
 */
export async function listAllConvaiAgentsMatchingTaskGuid(taskGuid: string): Promise<ConvaiAgentListItem[]> {
  const guid = String(taskGuid || '').trim();
  if (!guid) return [];
  const marker = `__GUID_${guid}`;
  const out: ConvaiAgentListItem[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    const page = await listConvaiAgentsViaOmniaServer({
      pageSize: 100,
      cursor,
      search: marker,
    });
    for (const a of page.agents) {
      if (!seen.has(a.agentId) && agentNameContainsTaskGuid(a.name, guid)) {
        seen.add(a.agentId);
        out.push(a);
      }
    }
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}
