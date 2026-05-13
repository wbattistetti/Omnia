/**
 * HTTP client for the AI cost subsystem (`/api/ai-calls/*`).
 *
 * Mirrors `iaCatalogApi.ts` shape for backend URL resolution and error propagation: no silent
 * fallback, the dialog/toolbar surface raw failures so users notice when the backend is down.
 */

function getApiBase(): string {
  const fromEnv = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_BACKEND_URL : '';
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.replace(/\/$/, '');
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return '';
  return 'http://127.0.0.1:3100';
}

const API_BASE = getApiBase();

export interface AiCallRecord {
  id: string;
  ts: string;
  providerId: string;
  modelId: string;
  purpose: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costEur: number | null;
  durationMs: number;
  pricingFound: boolean;
  error: string | null;
  /**
   * Task instance id originating the call. `null` per chiamate globali (es. `TEXT_TRANSLATE`
   * invocate dalla UI globale) o per record legacy precedenti all'introduzione del campo.
   * I record con `taskId` non-null finiscono raggruppati per task nel report ad albero.
   */
  taskId: string | null;
  /**
   * Snapshot della label del task al momento della chiamata. Mostrata come header del nodo
   * macro-task nel report. Snapshot intenzionale (non lookup live) per fedelt\u00e0 storica anche
   * dopo rinomine.
   */
  taskLabel: string | null;
}

export interface AiExchangeRate {
  usdToEur: number | null;
  fetchedAt: string | null;
  ecbDate: string | null;
}

export class AiCallsApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AiCallsApiError';
    this.status = status;
  }
}

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
    throw new AiCallsApiError(msg, res.status);
  }
  return body as T;
}

async function postEmpty<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST' });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && typeof (body as { error?: string }).error === 'string'
        ? (body as { error: string }).error
        : `${path} responded ${res.status}`;
    throw new AiCallsApiError(msg, res.status);
  }
  return body as T;
}

export async function fetchAiCalls(limit?: number): Promise<AiCallRecord[]> {
  const qs = typeof limit === 'number' ? `?limit=${encodeURIComponent(limit)}` : '';
  const data = await getJson<{ items: AiCallRecord[] }>(`/api/ai-calls${qs}`);
  return Array.isArray(data.items) ? data.items : [];
}

export async function clearAiCalls(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ai-calls`, { method: 'DELETE' });
  if (!res.ok) {
    throw new AiCallsApiError(`DELETE /api/ai-calls responded ${res.status}`, res.status);
  }
}

export async function fetchExchangeRate(): Promise<AiExchangeRate> {
  return getJson<AiExchangeRate>('/api/ai-calls/exchange-rate');
}

export async function refreshPricingCatalog(): Promise<{ count: number }> {
  return postEmpty<{ count: number }>('/api/ai-calls/pricing/refresh');
}

export async function refreshExchangeRate(): Promise<AiExchangeRate> {
  return postEmpty<AiExchangeRate>('/api/ai-calls/exchange-rate/refresh');
}
