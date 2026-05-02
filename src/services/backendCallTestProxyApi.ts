/**
 * Proxy ApiServer: inoltra richieste HTTP reali dal designer (evita CORS browser → backend esterni).
 */

import { stableJsonStringify } from '../utils/stableJsonStringify';
import type { BuiltBackendHttpRequest } from '../utils/backendCall/buildSendHttpRequest';

export type BackendCallProxyResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  bodyText: string;
  error?: string;
};

/** Risposta HTTP del proxy designer non è JSON envelope (ApiServer assente, HTML, ecc.). */
export const BACKEND_CALL_PROXY_ENVELOPE_NOT_JSON = 'Risposta proxy non JSON';

export function getOmniaApiServerBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __OMNIA_APISERVER_BASE__?: string };
    if (typeof w.__OMNIA_APISERVER_BASE__ === 'string' && w.__OMNIA_APISERVER_BASE__.trim()) {
      return w.__OMNIA_APISERVER_BASE__.trim().replace(/\/$/, '');
    }
    // Dev: same-origin + Vite `/api/designer` → Express :3100 (proxy Test API; evita catch-all /api → :8000).
    if (import.meta.env.DEV) {
      return '';
    }
  }
  return 'http://localhost:5000';
}

/**
 * Inoltra la richiesta costruita con {@link buildSendHttpRequest} tramite POST al proxy VB.
 */
export async function forwardBackendCallViaProxy(
  built: BuiltBackendHttpRequest,
  signal?: AbortSignal
): Promise<BackendCallProxyResponse> {
  const base = getOmniaApiServerBaseUrl();
  const path = '/api/designer/backend-call-test/proxy';
  const url = base ? `${base.replace(/\/$/, '')}${path}` : path;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: stableStringifyPayload({ target: built }),
    signal,
  });
  const rawText = await res.text();
  const text = rawText.replace(/^\uFEFF/, '');
  let parsed: { ok?: boolean; status?: number; statusText?: string; bodyText?: string; error?: string; err?: string } =
    {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return {
      ok: false,
      status: res.status,
      statusText: res.statusText,
      bodyText: text,
      error: BACKEND_CALL_PROXY_ENVELOPE_NOT_JSON,
    };
  }
  const errMsg = parsed.error ?? parsed.err;
  return {
    ok: Boolean(parsed.ok) && res.ok,
    status: typeof parsed.status === 'number' ? parsed.status : res.status,
    statusText: parsed.statusText || res.statusText,
    bodyText: typeof parsed.bodyText === 'string' ? parsed.bodyText : text,
    error: errMsg,
  };
}

function stableStringifyPayload(obj: unknown): string {
  return stableJsonStringify(obj);
}
