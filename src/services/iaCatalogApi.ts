/**
 * HTTP client for Express IA catalog (/api/ia-catalog). Nessun fallback: errori dal backend sono propagati.
 */

/** In dev, relative URLs hit the Vite proxy; override with VITE_BACKEND_URL when needed. */
function getCatalogApiBase(): string {
  const fromEnv = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_BACKEND_URL : '';
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.replace(/\/$/, '');
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return '';
  return 'http://127.0.0.1:3100';
}

const API_BASE = getCatalogApiBase();

export interface CatalogVoice {
  voice_id: string;
  name: string;
  preview_url: string | null;
  language?: string | null;
  gender?: string | null;
  category?: string | null;
  accent?: string | null;
  age_group?: string | null;
  description?: string | null;
  voice_description?: string | null;
  style?: string | null;
  provider?: string | null;
  tags?: string[];
  tts_family?: string | null;
  expressive_tags?: string[];
  raw?: Record<string, unknown>;
}

/** Query opzionali per GET /api/ia-catalog/ui/voices (filtri server). */
export type VoiceCatalogQueryParams = Partial<{
  q: string;
  language: string;
  accent: string;
  category: string;
  gender: string;
  age_group: string;
  style: string;
}>;

export interface CatalogLanguage {
  locale: string;
  label: string;
  sources?: string[];
}

export interface CatalogModel {
  model_id: string;
  name: string;
  provider: string;
  latency_ms: number | null;
  cost_hint: string | null;
  capabilities: Record<string, unknown>;
  tags: string[];
  notes: string | null;
  raw?: Record<string, unknown>;
}

/** Errore API catalogo con corpo JSON dal backend (503 / 400 / …). */
export class CatalogApiError extends Error {
  readonly status: number;

  readonly code?: string;

  readonly hint?: string;

  constructor(message: string, status: number, code?: string, hint?: string) {
    super(message);
    this.name = 'CatalogApiError';
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

async function parseCatalogResponse<T>(
  path: string,
  res: Response,
  mapper: (json: Record<string, unknown>) => T
): Promise<T> {
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }

  if (!res.ok) {
    const msg =
      typeof json.message === 'string'
        ? json.message
        : `${path} responded ${res.status}`;
    throw new CatalogApiError(
      msg,
      res.status,
      typeof json.code === 'string' ? json.code : undefined,
      typeof json.hint === 'string' ? json.hint : undefined
    );
  }

  if (json.ok === false) {
    throw new CatalogApiError(
      typeof json.message === 'string' ? json.message : 'Richiesta catalogo fallita',
      res.status || 400,
      typeof json.code === 'string' ? json.code : undefined,
      typeof json.hint === 'string' ? json.hint : undefined
    );
  }

  return mapper(json);
}

/** Voci ElevenLabs — richiede platform=elevenlabs (catalogo sincronizzato sul server). */
export async function fetchCatalogVoices(
  platform: 'elevenlabs',
  params?: VoiceCatalogQueryParams
): Promise<{ voices: CatalogVoice[]; applicable: boolean; message?: string }> {
  const qs = new URLSearchParams({ platform });
  if (params?.q) qs.set('q', params.q);
  const keys = ['language', 'accent', 'category', 'gender', 'age_group', 'style'] as const;
  for (const k of keys) {
    const v = params?.[k];
    if (typeof v === 'string' && v.trim()) qs.set(k, v.trim());
  }
  const path = `/api/ia-catalog/ui/voices?${qs.toString()}`;
  const res = await fetch(`${API_BASE}${path}`);
  const data = await parseCatalogResponse(path, res, (json) => json);

  const applicable = jsonApplicable(data);
  const items = (Array.isArray(data.items) ? data.items : []) as CatalogVoice[];
  const message = typeof data.message === 'string' ? data.message : undefined;

  if (!applicable) {
    return { voices: [], applicable: false, message };
  }

  return { voices: items, applicable: true, message };
}

function jsonApplicable(json: Record<string, unknown>): boolean {
  return json.applicable !== false;
}

/** Lingue (derivate dal sync ElevenLabs) — platform=elevenlabs. */
export async function fetchCatalogLanguages(
  platform: 'elevenlabs',
  q?: string
): Promise<{ languages: CatalogLanguage[]; applicable: boolean; message?: string }> {
  const qs = new URLSearchParams({ platform });
  if (q) qs.set('q', q);
  const path = `/api/ia-catalog/ui/languages?${qs.toString()}`;
  const res = await fetch(`${API_BASE}${path}`);
  const data = await parseCatalogResponse(path, res, (j) => j);

  const applicable = jsonApplicable(data);
  const raw = Array.isArray(data.items) ? data.items : [];
  const languages = raw.map((row: Record<string, unknown>) => ({
    locale: String(row.locale ?? ''),
    label: typeof row.label === 'string' ? row.label : String(row.locale ?? ''),
    sources: Array.isArray(row.sources) ? row.sources.map(String) : undefined,
  })) as CatalogLanguage[];

  const message = typeof data.message === 'string' ? data.message : undefined;
  if (!applicable) {
    return { languages: [], applicable: false, message };
  }
  return { languages, applicable: true };
}

/** Modelli LLM per provider (sync OpenAI / Anthropic / Google sul server). */
export async function fetchCatalogModels(
  provider: 'openai' | 'anthropic' | 'google',
  q?: string
): Promise<CatalogModel[]> {
  const qs = new URLSearchParams({ provider });
  if (q) qs.set('q', q);
  const path = `/api/ia-catalog/ui/models?${qs.toString()}`;
  const res = await fetch(`${API_BASE}${path}`);
  const data = await parseCatalogResponse(path, res, (j) => j);
  const items = (Array.isArray(data.items) ? data.items : []) as CatalogModel[];
  return items;
}

export async function refreshIaCatalog(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/ia-catalog/refresh`, { method: 'POST' });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  if (!res.ok) {
    throw new CatalogApiError(
      typeof json.message === 'string' ? json.message : `refresh ${res.status}`,
      res.status,
      typeof json.code === 'string' ? json.code : undefined
    );
  }
  return json;
}
