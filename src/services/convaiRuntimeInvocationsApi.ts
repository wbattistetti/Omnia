/**
 * HTTP client log runtime ConvAI (`/api/convai-runtime-invocations`, schema V2).
 */

import type { ConvaiRuntimeInvocationRecord } from '@domain/convaiObservability/convaiRuntimeInvocationRecord';
import { isConvaiRuntimeInvocationRecord } from '@domain/convaiObservability/convaiRuntimeInvocationRecord';
import { resolveOmniaApiBase } from './resolveOmniaApiBase';

const API_BASE = resolveOmniaApiBase();

export class ConvaiRuntimeInvocationsApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ConvaiRuntimeInvocationsApiError';
    this.status = status;
  }
}

export type FetchConvaiRuntimeInvocationsParams = {
  limit?: number;
  conversationId?: string;
  kind?: string;
  projectId?: string;
  agentTaskId?: string;
  backendTaskId?: string;
  since?: string;
  until?: string;
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
    throw new ConvaiRuntimeInvocationsApiError(msg, res.status);
  }
  return body as T;
}

export async function fetchConvaiRuntimeInvocations(
  params: FetchConvaiRuntimeInvocationsParams = {}
): Promise<ConvaiRuntimeInvocationRecord[]> {
  const qs = new URLSearchParams();
  if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
  if (params.conversationId?.trim()) qs.set('conversationId', params.conversationId.trim());
  if (params.kind?.trim()) qs.set('kind', params.kind.trim());
  if (params.projectId?.trim()) qs.set('projectId', params.projectId.trim());
  if (params.agentTaskId?.trim()) qs.set('agentTaskId', params.agentTaskId.trim());
  if (params.backendTaskId?.trim()) qs.set('backendTaskId', params.backendTaskId.trim());
  if (params.since?.trim()) qs.set('since', params.since.trim());
  if (params.until?.trim()) qs.set('until', params.until.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await getJson<{ items: unknown[]; schemaVersion: number }>(
    `/api/convai-runtime-invocations${suffix}`
  );
  if (!Array.isArray(data.items)) return [];
  return data.items.filter(isConvaiRuntimeInvocationRecord);
}

export async function clearConvaiRuntimeInvocations(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/convai-runtime-invocations`, { method: 'DELETE' });
  if (!res.ok) {
    throw new ConvaiRuntimeInvocationsApiError(
      `DELETE /api/convai-runtime-invocations responded ${res.status}`,
      res.status
    );
  }
}
