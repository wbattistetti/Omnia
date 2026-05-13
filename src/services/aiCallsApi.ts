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

/**
 * Voce del catalogo pricing — coerente con `pricingSync.js` lato backend
 * (`mapOpenRouterRow`). I prezzi sono normalizzati in **USD per milione di token**
 * per stabilità aritmetica. La conversione in EUR avviene SOLO sul frontend usando
 * il cambio cached ECB (`AiExchangeRate.usdToEur`).
 *
 * Un modello "free" arriva con `inputUsdPer1M=0` e `outputUsdPer1M=0`.
 * Un modello non-mappato dal catalogo OpenRouter NON appare in lista (silenziosamente
 * filtrato): chi chiama il calcolatore di costo lo tratta come `pricingFound=false`.
 */
export interface LlmPricingEntry {
  providerId: 'openai' | 'groq' | 'anthropic' | 'google';
  modelId: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  contextLength: number | null;
  rawId: string;
}

/**
 * Risposta di `GET /api/ai-calls/pricing` — snapshot del catalogo on-disk dei prezzi.
 * `meta.updatedAt` = ISO della scrittura cache; `meta.source` = 'openrouter' | null.
 */
export interface LlmPricingCatalogResponse {
  count: number;
  meta: { updatedAt: string | null; source: string | null };
  items: LlmPricingEntry[];
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

/**
 * Snapshot del catalogo pricing live (read-only). Wrapper su
 * `GET /api/ai-calls/pricing`. Non mutala il backend; per forzare un re-sync
 * usare {@link refreshPricingCatalog}.
 */
export async function fetchPricingCatalog(): Promise<LlmPricingCatalogResponse> {
  const data = await getJson<{
    count?: number;
    meta?: { updatedAt: string | null; source: string | null };
    items?: LlmPricingEntry[];
  }>('/api/ai-calls/pricing');
  return {
    count: typeof data.count === 'number' ? data.count : 0,
    meta: {
      updatedAt: data.meta?.updatedAt ?? null,
      source: data.meta?.source ?? null,
    },
    items: Array.isArray(data.items) ? data.items : [],
  };
}

export async function refreshExchangeRate(): Promise<AiExchangeRate> {
  return postEmpty<AiExchangeRate>('/api/ai-calls/exchange-rate/refresh');
}
