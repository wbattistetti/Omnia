/**
 * Client API for portal OAuth (FastAPI `/api/auth/portal/*`).
 */

import type { PortalConnectionMeta } from '@domain/portalAuth/portalConnectionTypes';

export type PortalAuthStartResult = {
  authUrl: string;
  connectionId: string;
  state: string;
  origin: string;
};

export type PortalOAuthMessage = {
  type: 'omnia-portal-oauth';
  success: boolean;
  message: string;
  connectionId: string | null;
  returnUrl?: string;
  origin?: string;
  projectId?: string;
};

export function isPortalOAuthMessage(data: unknown): data is PortalOAuthMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as PortalOAuthMessage).type === 'omnia-portal-oauth'
  );
}

export async function startPortalOAuth(params: {
  projectId: string;
  origin: string;
  returnUrl?: string;
  provider?: 'google_workspace';
}): Promise<PortalAuthStartResult> {
  const res = await fetch('/api/auth/portal/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({
      project_id: params.projectId,
      origin: params.origin,
      return_url: params.returnUrl ?? window.location.pathname + window.location.search,
      provider: params.provider ?? 'google_workspace',
    }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { detail?: string | { message?: string } };
      if (typeof j.detail === 'string') msg = j.detail;
      else if (j.detail && typeof j.detail === 'object' && typeof j.detail.message === 'string') {
        msg = j.detail.message;
      }
    } catch {
      /* ignore */
    }
    if (res.status === 404) {
      throw new Error(
        'Endpoint OAuth non trovato. Riavvia il backend Python (npm run dev:beNew) dopo l’aggiornamento.'
      );
    }
    if (res.status === 503) {
      throw new Error(
        msg.includes('OAuth')
          ? msg
          : 'OAuth Google non configurato: imposta OMNIA_GOOGLE_OAUTH_CLIENT_ID e OMNIA_GOOGLE_OAUTH_CLIENT_SECRET sul processo FastAPI (porta 8000).'
      );
    }
    throw new Error(msg);
  }
  const body = (await res.json()) as PortalAuthStartResult;
  return body;
}

export async function listPortalConnections(projectId: string): Promise<PortalConnectionMeta[]> {
  const qs = new URLSearchParams({ project_id: projectId });
  const res = await fetch(`/api/auth/portal/connections?${qs}`, { credentials: 'omit' });
  if (!res.ok) return [];
  const j = (await res.json()) as { connections?: PortalConnectionMeta[] };
  return Array.isArray(j.connections) ? j.connections : [];
}

export async function resolvePortalConnection(
  projectId: string,
  origin: string
): Promise<PortalConnectionMeta | null> {
  const qs = new URLSearchParams({ project_id: projectId, origin });
  const res = await fetch(`/api/auth/portal/resolve?${qs}`, { credentials: 'omit' });
  if (!res.ok) return null;
  const j = (await res.json()) as { connection?: PortalConnectionMeta | null };
  return j.connection ?? null;
}

export async function deletePortalConnection(connectionId: string): Promise<void> {
  await fetch(`/api/auth/portal/connections/${encodeURIComponent(connectionId)}`, {
    method: 'DELETE',
    credentials: 'omit',
  });
}

/**
 * Opens Google OAuth in a popup; resolves when postMessage reports success.
 */
export function openPortalOAuthPopup(authUrl: string): Promise<PortalOAuthMessage> {
  return new Promise((resolve, reject) => {
    const w = window.open(authUrl, 'omnia_portal_oauth', 'width=520,height=640');
    if (!w) {
      reject(new Error('Popup bloccato dal browser. Consenti i popup per questo sito.'));
      return;
    }
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timeout connessione portale (5 min).'));
    }, 5 * 60 * 1000);

    const onMessage = (ev: MessageEvent) => {
      if (!isPortalOAuthMessage(ev.data)) return;
      cleanup();
      resolve(ev.data);
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };

    window.addEventListener('message', onMessage);
  });
}
