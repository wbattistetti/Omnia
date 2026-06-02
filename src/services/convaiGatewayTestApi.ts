/**
 * Test Backend Call via gateway ConvAI (stesso percorso ElevenLabs: sendHints agente → forward upstream).
 */

import type { BackendCallProxyResponse } from './backendCallTestProxyApi';

/** In dev Vite, path relativo → proxy Express :3100; ngrok URL pubblico resta assoluto. */
export function resolveConvaiGatewayFetchUrl(gatewayPublicUrl: string): string {
  const trimmed = gatewayPublicUrl.trim();
  if (!trimmed) return trimmed;
  if (import.meta.env.DEV) {
    try {
      const u = new URL(trimmed);
      const isLocal =
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname === '[::1]';
      if (isLocal) return `${u.pathname}${u.search}`;
    } catch {
      if (trimmed.startsWith('/')) return trimmed;
    }
  }
  return trimmed;
}

/**
 * POST body tool ConvAI al gateway Omnia (non applicare sendHints lato client).
 */
export async function forwardBackendCallViaConvaiGateway(params: {
  gatewayPublicUrl: string;
  bodyJson: string | null;
  signal?: AbortSignal;
}): Promise<BackendCallProxyResponse> {
  const fetchUrl = resolveConvaiGatewayFetchUrl(params.gatewayPublicUrl);
  const body =
    params.bodyJson?.trim() && params.bodyJson.trim() !== '{}'
      ? (JSON.parse(params.bodyJson) as unknown)
      : {};

  const res = await fetch(fetchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: params.signal,
  });
  const bodyText = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    bodyText,
    error: res.ok ? undefined : `HTTP ${res.status}`,
  };
}
