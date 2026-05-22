/**
 * Client per il canale review condiviso (GET/PUT su project_meta via Express).
 */

import type { AgentReviewChannelDocument } from '@domain/agentReviewChannel/reviewDocument';
import type { AgentReviewAudience } from '@domain/agentReviewChannel/reviewAudience';
import { normalizeReviewAudience } from '@domain/agentReviewChannel/reviewAudience';

export interface ReviewChannelFetchResult {
  document: AgentReviewChannelDocument | null;
  updatedAt: string | null;
}

export interface ReviewChannelListItem {
  projectId: string;
  projectLabel: string;
  taskInstanceId: string;
  taskLabel: string;
  updatedAt: string | null;
  useCaseCount: number;
}

function reviewHeaders(token?: string): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = typeof token === 'string' ? token.trim() : '';
  if (t) h['X-Review-Token'] = t;
  return h;
}

export function resolveReviewChannelApiBase(): string {
  const env =
    typeof import.meta !== 'undefined' && import.meta.env
      ? String((import.meta.env as Record<string, string | undefined>).VITE_BACKEND_URL ?? '').trim()
      : '';
  if (env) return env.replace(/\/$/, '');
  return '';
}

function reviewChannelPath(
  projectId: string,
  taskInstanceId: string,
  audience?: AgentReviewAudience
): string {
  const base = `/api/projects/${encodeURIComponent(projectId)}/agent-tasks/${encodeURIComponent(taskInstanceId)}/review-channel`;
  const aud = audience ? normalizeReviewAudience(audience) : '';
  return aud ? `${base}?audience=${encodeURIComponent(aud)}` : base;
}

export async function listReviewChannels(params?: {
  token?: string;
  apiBase?: string;
}): Promise<ReviewChannelListItem[]> {
  const base = (params?.apiBase ?? resolveReviewChannelApiBase()).replace(/\/$/, '');
  const path = '/api/agent-review-channels';
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, { headers: reviewHeaders(params?.token) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`listReviewChannels: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { items?: ReviewChannelListItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchAgentReviewChannel(params: {
  projectId: string;
  taskInstanceId: string;
  audience?: AgentReviewAudience;
  token?: string;
  apiBase?: string;
}): Promise<ReviewChannelFetchResult> {
  const { projectId, taskInstanceId, audience, token, apiBase } = params;
  const base = (apiBase ?? resolveReviewChannelApiBase()).replace(/\/$/, '');
  const path = reviewChannelPath(projectId, taskInstanceId, audience);
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, { headers: reviewHeaders(token) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fetchAgentReviewChannel: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    document?: unknown;
    updatedAt?: string | null;
  };
  const { parseAgentReviewDocument } = await import('@domain/agentReviewChannel/reviewDocument');
  const document = data.document ? parseAgentReviewDocument(data.document) : null;
  return {
    document,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  };
}

export async function saveAgentReviewChannel(params: {
  projectId: string;
  taskInstanceId: string;
  document: AgentReviewChannelDocument;
  audience?: AgentReviewAudience;
  token?: string;
  apiBase?: string;
  /** HTTP header `X-Review-Source` (default `omnia`). */
  source?: 'omnia' | 'portal';
}): Promise<ReviewChannelFetchResult> {
  const { projectId, taskInstanceId, document, audience, token, apiBase, source = 'omnia' } = params;
  const base = (apiBase ?? resolveReviewChannelApiBase()).replace(/\/$/, '');
  const path = reviewChannelPath(
    projectId,
    taskInstanceId,
    audience ?? document.reviewAudience
  );
  const url = base ? `${base}${path}` : path;
  const headers = reviewHeaders(token) as Record<string, string>;
  headers['X-Review-Source'] = source;
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ document }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j?.error) detail = j.error;
    } catch {
      /* raw text */
    }
    const hint =
      res.status === 500 && !detail
        ? ' — Verifica che Express (:3100) sia avviato (npm run dev:beNew).'
        : '';
    throw new Error(`saveAgentReviewChannel: ${res.status} ${detail}${hint}`);
  }
  const data = (await res.json()) as {
    document?: unknown;
    updatedAt?: string | null;
  };
  const { parseAgentReviewDocument } = await import('@domain/agentReviewChannel/reviewDocument');
  const parsed = data.document ? parseAgentReviewDocument(data.document) : document;
  return {
    document: parsed,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : parsed?.updatedAt ?? null,
  };
}

/** Intervallo consigliato per poll di backup se SSE non disponibile. */
export const REVIEW_CHANNEL_POLL_MS = 20_000;

/**
 * SSE: il server invia `review_channel_updated` dopo PUT o POST .../notify (portale).
 * EventSource non supporta header custom → token in query.
 */
export function subscribeReviewChannelEvents(params: {
  projectId: string;
  taskInstanceId: string;
  token?: string;
  onUpdate: () => void;
}): () => void {
  if (typeof EventSource === 'undefined') return () => {};
  const { projectId, taskInstanceId, token, onUpdate } = params;
  const t = typeof token === 'string' ? token.trim() : '';
  const qs = new URLSearchParams();
  if (t) qs.set('token', t);
  const q = qs.toString();
  const base = resolveReviewChannelApiBase().replace(/\/$/, '');
  const path = `/api/projects/${encodeURIComponent(projectId)}/agent-tasks/${encodeURIComponent(taskInstanceId)}/review-channel/events${q ? `?${q}` : ''}`;
  const url = base ? `${base}${path}` : path;
  const es = new EventSource(url);
  const handler = () => onUpdate();
  es.addEventListener('review_channel_updated', handler);
  // Backend assente o connessione chiusa: evita reconnect EventSource → flood ECONNRESET nel proxy Vite
  es.onerror = () => {
    es.close();
  };
  return () => {
    es.removeEventListener('review_channel_updated', handler);
    es.close();
  };
}

/**
 * Webhook verso Omnia quando un portale esterno (es. Bolt) salva una review.
 */
export async function notifyReviewChannelFromPortal(params: {
  projectId: string;
  taskInstanceId: string;
  audience: AgentReviewAudience;
  updatedAt?: string;
  contentHash?: string;
  token?: string;
}): Promise<void> {
  const { projectId, taskInstanceId, audience, updatedAt, contentHash, token } = params;
  const base = resolveReviewChannelApiBase().replace(/\/$/, '');
  const path = `/api/projects/${encodeURIComponent(projectId)}/agent-tasks/${encodeURIComponent(taskInstanceId)}/review-channel/notify`;
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, {
    method: 'POST',
    headers: reviewHeaders(token),
    body: JSON.stringify({
      audience,
      updatedAt,
      contentHash,
      source: 'portal',
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`notifyReviewChannelFromPortal: ${res.status} ${text}`);
  }
}
