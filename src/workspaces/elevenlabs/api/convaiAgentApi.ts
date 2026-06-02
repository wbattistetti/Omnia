/**
 * HTTP client for Omnia ApiServer ElevenLabs ConvAI agent endpoints (design-time workspace).
 */

import {
  formatConvaiAgentHttpError,
  formatDeleteAgentHttpError,
  formatListAgentsHttpError,
} from '@services/convaiProvisionHttpError';
import type { ConvaiAgentListItem } from '@services/convaiProvisionApi';

export type ConvaiAgentDetail = {
  agentId: string;
  name: string;
  conversationConfig: Record<string, unknown>;
  raw: Record<string, unknown>;
};

function pickAgentId(data: Record<string, unknown>): string {
  const id =
    typeof data.agent_id === 'string'
      ? data.agent_id
      : typeof data.agentId === 'string'
        ? data.agentId
        : '';
  return id.trim();
}

function pickAgentName(data: Record<string, unknown>): string {
  return typeof data.name === 'string' ? data.name.trim() : '';
}

function pickConversationConfig(data: Record<string, unknown>): Record<string, unknown> {
  const ccRaw = data.conversation_config ?? data.conversationConfig;
  const cc =
    ccRaw && typeof ccRaw === 'object' && !Array.isArray(ccRaw)
      ? ({ ...(ccRaw as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  /** ElevenLabs GET agent returns `workflow` at root, not only under conversation_config. */
  const topWorkflow = data.workflow;
  if (topWorkflow && typeof topWorkflow === 'object' && !Array.isArray(topWorkflow)) {
    cc.workflow = topWorkflow;
  }
  return cc;
}

async function readJsonResponse(res: Response, url: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      typeof text === 'string' && text.trim()
        ? `HTTP ${res.status} — ${text.trim().slice(0, 400)}`
        : `HTTP ${res.status} (${url})`
    );
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON (${res.status}) from ${url}`);
  }
}

/** GET /elevenlabs/agents — reuses list shape from convaiProvisionApi. */
export async function listConvaiAgentsForWorkspace(params?: {
  pageSize?: number;
  cursor?: string | null;
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
  if (!res.ok) {
    throw new Error(formatListAgentsHttpError(res, url, text));
  }
  let data: Record<string, unknown> = {};
  try {
    data = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`listAgents: risposta non JSON (${res.status})`);
  }
  const agents: ConvaiAgentListItem[] = [];
  const agentsRaw = data.agents;
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
    typeof data.next_cursor === 'string' && data.next_cursor.trim()
      ? data.next_cursor.trim()
      : typeof data.nextCursor === 'string' && data.nextCursor.trim()
        ? data.nextCursor.trim()
        : null;
  const hasMore = data.has_more === true || data.hasMore === true;
  return { agents, nextCursor, hasMore };
}

/** GET /elevenlabs/agents/{agentId} — full agent including conversation_config. */
export async function getConvaiAgentDetail(agentId: string): Promise<ConvaiAgentDetail> {
  const id = String(agentId || '').trim();
  if (!id) throw new Error('getAgent: agentId mancante');
  const url = `/elevenlabs/agents/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: 'GET' });
  const data = await readJsonResponse(res, url);
  const resolvedId = pickAgentId(data) || id;
  return {
    agentId: resolvedId,
    name: pickAgentName(data),
    conversationConfig: pickConversationConfig(data),
    raw: data,
  };
}

/** PATCH /elevenlabs/agents/{agentId} — partial update (e.g. conversation_config). */
export async function patchConvaiAgent(
  agentId: string,
  body: Record<string, unknown>
): Promise<void> {
  const id = String(agentId || '').trim();
  if (!id) throw new Error('patchAgent: agentId mancante');
  const url = `/elevenlabs/agents/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatConvaiAgentHttpError('patchAgent', res, id, text));
  }
}
