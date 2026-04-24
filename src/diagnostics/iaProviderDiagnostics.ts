/**
 * Client per GET /api/ia-catalog/diagnostics — stato env Node + cataloghi sincronizzati (no segreti).
 */

function getDiagnosticsApiBase(): string {
  const fromEnv = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_BACKEND_URL : '';
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.replace(/\/$/, '');
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return '';
  return 'http://127.0.0.1:3100';
}

export interface IaProviderDiagnosticResult {
  ok: boolean;
  provider: string;
  env: {
    apiKeyPresent: boolean;
    apiBasePresent: boolean;
  };
  catalog: {
    modelsCount: number;
    voicesCount?: number;
    languagesCount?: number;
  };
  errors: string[];
  hints?: string[];
  message?: string;
  code?: string;
}

export async function runIaProviderDiagnostics(
  provider: string
): Promise<IaProviderDiagnosticResult> {
  const p = String(provider ?? '')
    .trim()
    .toLowerCase();
  const qs = new URLSearchParams({ provider: p });
  const path = `/api/ia-catalog/diagnostics?${qs.toString()}`;
  const base = getDiagnosticsApiBase();
  const res = await fetch(`${base}${path}`);
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }

  if (!res.ok) {
    const msg =
      typeof json.message === 'string' ? json.message : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (json.ok === false) {
    throw new Error(typeof json.message === 'string' ? json.message : 'Diagnostica fallita');
  }

  const env = json.env as IaProviderDiagnosticResult['env'] | undefined;
  const catalog = json.catalog as IaProviderDiagnosticResult['catalog'] | undefined;
  const errors = Array.isArray(json.errors) ? (json.errors as string[]) : [];
  const hints = Array.isArray(json.hints) ? (json.hints as string[]) : undefined;

  return {
    ok: true,
    provider: String(json.provider ?? p),
    env: env ?? { apiKeyPresent: false, apiBasePresent: false },
    catalog: catalog ?? { modelsCount: 0 },
    errors,
    hints,
  };
}
