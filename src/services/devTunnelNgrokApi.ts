/**
 * Client HTTP per tunnel ngrok multi-porta (Express :3100).
 */

function expressDevOrigin(): string {
  if (!import.meta.env.DEV) return '';
  const fromEnv = typeof import.meta.env.VITE_EXPRESS_DEV_URL === 'string'
    ? import.meta.env.VITE_EXPRESS_DEV_URL.trim()
    : '';
  return fromEnv || 'http://127.0.0.1:3100';
}

function apiUrl(path: string): string {
  const base = expressDevOrigin();
  if (!base) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${p}`;
}

async function readJson<T>(res: Response): Promise<{ data?: T; error?: string }> {
  const text = await res.text();
  const t = text.trim();
  if (!t) return {};
  if (t.startsWith('<')) {
    return { error: 'Risposta HTML: avvia Express (npm run be:express).' };
  }
  try {
    return { data: JSON.parse(text) as T };
  } catch {
    return { error: `Risposta non JSON (HTTP ${res.status})` };
  }
}

export type TunnelRowStatus = {
  running?: boolean;
  publicUrl?: string | null;
};

export type NgrokMultiStatus = {
  ok: boolean;
  running?: boolean;
  sdkAvailable?: boolean;
  tunnels?: Record<string, TunnelRowStatus>;
  lastStartError?: string | null;
  error?: string;
};

export type NgrokMultiStartResult = {
  ok: boolean;
  tunnels?: Record<string, { publicUrl: string | null; localPort: number }>;
  errors?: Array<{ port: number; message: string }>;
  error?: string;
};

export async function fetchNgrokTunnelStatus(): Promise<NgrokMultiStatus> {
  const url = apiUrl('/api/dev-tunnel/ngrok/status');
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    return {
      ok: false,
      error: `Connessione Express fallita: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const { data, error } = await readJson<NgrokMultiStatus>(res);
  if (error) return { ok: false, error };
  if (!data) return { ok: false, error: `HTTP ${res.status}` };
  if (!res.ok && !data.error) return { ok: false, error: `HTTP ${res.status}` };
  return data;
}

export async function startNgrokTunnels(params: {
  ports: number[];
  authtoken?: string;
}): Promise<NgrokMultiStartResult> {
  const url = apiUrl('/api/dev-tunnel/ngrok/start');
  let res: Response;
  try {
    const ports = params.ports
      .map((p) => Number(p))
      .filter((p) => Number.isFinite(p) && p >= 1 && p <= 65535);
    const unique = [...new Set(ports)];
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ports: unique,
        /** Retro-compat: vecchi server Express leggono solo `port`, non `ports`. */
        ...(unique.length ? { port: unique[0] } : {}),
        ...(params.authtoken?.trim() ? { authtoken: params.authtoken.trim() } : {}),
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const { data, error } = await readJson<NgrokMultiStartResult>(res);
  if (error) return { ok: false, error };
  if (!data) return { ok: false, error: `HTTP ${res.status}` };
  if (!res.ok && !data.error) return { ok: false, error: `HTTP ${res.status}` };
  return data;
}

export async function stopNgrokTunnels(): Promise<{ ok: boolean; error?: string }> {
  const url = apiUrl('/api/dev-tunnel/ngrok/stop');
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const { data, error } = await readJson<{ ok: boolean; error?: string }>(res);
  if (error) return { ok: false, error };
  if (!data) return { ok: false, error: `HTTP ${res.status}` };
  if (!res.ok && !data.error) return { ok: false, error: `HTTP ${res.status}` };
  return data;
}
