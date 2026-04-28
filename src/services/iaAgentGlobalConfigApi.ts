/**
 * Persistenza default runtime IA agent per progetto (`project_meta.iaAgentGlobalConfigJson`).
 *
 * GET: HTTP 404 viene interpretato come «nessun blob salvato» (come `{ config: null }`), così la UI
 * mostra i default invece di un errore bloccante (es. route non ancora deployata o proxy verso
 * un processo senza handler).
 */

export type FetchIaAgentGlobalResult =
  | { ok: true; configJson: string | null }
  | { ok: false; error: string };

export async function fetchIaAgentGlobalConfig(projectId: string): Promise<FetchIaAgentGlobalResult> {
  if (!projectId?.trim()) return { ok: false, error: 'projectId mancante' };
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ia-agent-global-config`);
    /** Route assente o proxy verso server senza handler: stesso significato di «nessun JSON salvato». */
    if (res.status === 404) {
      return { ok: true, configJson: null };
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as { config?: string | null };
    const raw = data.config;
    return { ok: true, configJson: typeof raw === 'string' && raw.trim() ? raw : null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type PutIaAgentGlobalResult = { ok: true } | { ok: false; error: string };

export async function putIaAgentGlobalConfig(
  projectId: string,
  configJson: string
): Promise<PutIaAgentGlobalResult> {
  if (!projectId?.trim()) return { ok: false, error: 'projectId mancante' };
  const url = `/api/projects/${encodeURIComponent(projectId)}/ia-agent-global-config`;
  const init: RequestInit = {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: configJson }),
  };
  try {
    let res = await fetch(url, init);
    if (res.status === 404) {
      res = await fetch(url, { ...init, method: 'POST' });
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return {
        ok: false,
        error: `HTTP ${res.status}: ${t.slice(0, 200)} — Avvia o riavvia Express: node backend/server.js (porta 3100).`,
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
