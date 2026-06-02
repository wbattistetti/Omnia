/**
 * HTTP client for ConvAI webhook invocation guardalog (`/api/convai-webhook-invocations`).
 */

import { resolveOmniaApiBase } from './resolveOmniaApiBase';

const API_BASE = resolveOmniaApiBase();

export interface ConvaiWebhookInvocationRecord {
  id: string;
  ts: string;
  projectId: string | null;
  agentTaskId: string | null;
  backendTaskId: string | null;
  backendLabel: string | null;
  gatewayPath: string | null;
  upstreamUrl: string | null;
  forwardMethod: string;
  requestBodyFromClient: string | null;
  requestBodyAfterSendHints: string | null;
  upstreamStatus: number | null;
  upstreamResponsePreview: string | null;
  durationMs: number;
  sendHintsApplied: number;
  error: string | null;
}

export class ConvaiWebhookInvocationsApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ConvaiWebhookInvocationsApiError';
    this.status = status;
  }
}

export type FetchConvaiWebhookInvocationsParams = {
  limit?: number;
  projectId?: string;
  agentTaskId?: string;
  backendTaskId?: string;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || (body && typeof body === 'object' && (body as { ok?: boolean }).ok === false)) {
    const msg =
      body && typeof body === 'object' && typeof (body as { error?: string }).error === 'string'
        ? (body as { error: string }).error
        : `${path} responded ${res.status}`;
    throw new ConvaiWebhookInvocationsApiError(msg, res.status);
  }
  return body as T;
}

export async function fetchConvaiWebhookInvocations(
  params: FetchConvaiWebhookInvocationsParams = {}
): Promise<ConvaiWebhookInvocationRecord[]> {
  const qs = new URLSearchParams();
  if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
  if (params.projectId?.trim()) qs.set('projectId', params.projectId.trim());
  if (params.agentTaskId?.trim()) qs.set('agentTaskId', params.agentTaskId.trim());
  if (params.backendTaskId?.trim()) qs.set('backendTaskId', params.backendTaskId.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await getJson<{ items: ConvaiWebhookInvocationRecord[] }>(
    `/api/convai-webhook-invocations${suffix}`
  );
  return Array.isArray(data.items) ? data.items : [];
}

export async function clearConvaiWebhookInvocations(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/convai-webhook-invocations`, { method: 'DELETE' });
  if (!res.ok) {
    throw new ConvaiWebhookInvocationsApiError(
      `DELETE /api/convai-webhook-invocations responded ${res.status}`,
      res.status
    );
  }
}
