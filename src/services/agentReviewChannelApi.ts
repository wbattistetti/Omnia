/**
 * Client per il canale review condiviso (GET/PUT su project_meta via Express).
 */

import type { AgentReviewChannelDocument } from '@domain/agentReviewChannel/reviewDocument';

export interface ReviewChannelFetchResult {
  document: AgentReviewChannelDocument | null;
  updatedAt: string | null;
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

export async function fetchAgentReviewChannel(params: {
  projectId: string;
  taskInstanceId: string;
  token?: string;
  apiBase?: string;
}): Promise<ReviewChannelFetchResult> {
  const { projectId, taskInstanceId, token, apiBase } = params;
  const base = (apiBase ?? resolveReviewChannelApiBase()).replace(/\/$/, '');
  const path = `/api/projects/${encodeURIComponent(projectId)}/agent-tasks/${encodeURIComponent(taskInstanceId)}/review-channel`;
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
  token?: string;
  apiBase?: string;
}): Promise<ReviewChannelFetchResult> {
  const { projectId, taskInstanceId, document, token, apiBase } = params;
  const base = (apiBase ?? resolveReviewChannelApiBase()).replace(/\/$/, '');
  const path = `/api/projects/${encodeURIComponent(projectId)}/agent-tasks/${encodeURIComponent(taskInstanceId)}/review-channel`;
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, {
    method: 'PUT',
    headers: reviewHeaders(token),
    body: JSON.stringify({ document }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`saveAgentReviewChannel: ${res.status} ${text}`);
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
