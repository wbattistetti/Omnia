/**
 * Catalogo costi UI-only per modelli LLM/TTS (editing locale in pagina setup).
 */

export interface ModelCostRow {
  id: string;
  provider: string;
  model: string;
  latency: string;
  costPerMin: string;
  languages: string;
  deprecated?: boolean;
}

type LlmSeed = {
  provider: string;
  model: string;
  latency: string;
  costPerMin: number;
  languages: 'any';
};

type TtsSeed = {
  model_id: string;
  description: string;
  languages: string | string[];
  type: 'tts' | 'sts';
  deprecated: boolean;
};

const LLM_SEED: ReadonlyArray<LlmSeed> = [
  { provider: 'OpenAI', model: 'GPT-5', latency: '1.3s', costPerMin: 0.0105, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-5.1', latency: '1.08s', costPerMin: 0.0105, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-5.2', latency: '983ms', costPerMin: 0.0147, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-5 Mini', latency: '1.23s', costPerMin: 0.0021, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-5 Nano', latency: '999ms', costPerMin: 0.0004, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-4.1', latency: '1.0s', costPerMin: 0.0144, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-4.1 Mini', latency: '1.01s', costPerMin: 0.0029, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-4.1 Nano', latency: '557ms', costPerMin: 0.0007, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-4o', latency: '762ms', costPerMin: 0.018, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-4o Mini', latency: '671ms', costPerMin: 0.0011, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-4 Turbo', latency: '1.45s', costPerMin: 0.0689, languages: 'any' },
  { provider: 'OpenAI', model: 'GPT-3.5 Turbo', latency: '1.63s', costPerMin: 0.0034, languages: 'any' },
  { provider: 'Anthropic', model: 'Claude Sonnet 4.6', latency: '1.32s', costPerMin: 0.0225, languages: 'any' },
  { provider: 'Anthropic', model: 'Claude Sonnet 4.5', latency: '1.68s', costPerMin: 0.0225, languages: 'any' },
  { provider: 'Anthropic', model: 'Claude Sonnet 4', latency: '1.35s', costPerMin: 0.0225, languages: 'any' },
  { provider: 'Anthropic', model: 'Claude Haiku 4.5', latency: '767ms', costPerMin: 0.0075, languages: 'any' },
  { provider: 'Anthropic', model: 'Claude 3.7 Sonnet', latency: '1.06s', costPerMin: 0.0225, languages: 'any' },
  { provider: 'Anthropic', model: 'Claude 3 Haiku', latency: '730ms', costPerMin: 0.0019, languages: 'any' },
  { provider: 'Google', model: 'Gemini 3.1 Pro Preview', latency: '2.49s', costPerMin: 0.0156, languages: 'any' },
  { provider: 'Google', model: 'Gemini 3 Flash Preview', latency: '1.11s', costPerMin: 0.0039, languages: 'any' },
  {
    provider: 'Google',
    model: 'Gemini 3.1 Flash Lite Preview',
    latency: '1.16s',
    costPerMin: 0.0039,
    languages: 'any',
  },
  { provider: 'Google', model: 'Gemini 2.5 Flash', latency: '936ms', costPerMin: 0.0011, languages: 'any' },
  { provider: 'Google', model: 'Gemini 2.5 Flash Lite', latency: '504ms', costPerMin: 0.0007, languages: 'any' },
  { provider: 'ElevenLabs', model: 'GLM-4.5-Air', latency: '336ms', costPerMin: 0.0092, languages: 'any' },
  { provider: 'ElevenLabs', model: 'Qwen3-30B-A3B', latency: '234ms', costPerMin: 0.0028, languages: 'any' },
  { provider: 'ElevenLabs', model: 'GPT-OSS-120B', latency: '340ms', costPerMin: 0.0028, languages: 'any' },
];

const TTS_SEED: ReadonlyArray<TtsSeed> = [
  {
    model_id: 'eleven_v3',
    description: 'Human-like and expressive speech generation',
    languages: '70+ languages',
    type: 'tts',
    deprecated: false,
  },
  {
    model_id: 'eleven_ttv_v3',
    description: 'Human-like and expressive voice design model',
    languages: '70+ languages',
    type: 'tts',
    deprecated: false,
  },
  {
    model_id: 'eleven_multilingual_v2',
    description: 'Lifelike multilingual speech synthesis',
    languages: [
      'en', 'ja', 'zh', 'de', 'hi', 'fr', 'ko', 'pt', 'it', 'es', 'id', 'nl', 'tr', 'fil', 'pl', 'sv', 'bg',
      'ro', 'ar', 'cs', 'el', 'fi', 'hr', 'ms', 'sk', 'da', 'ta', 'uk', 'ru',
    ],
    type: 'tts',
    deprecated: false,
  },
  {
    model_id: 'eleven_flash_v2_5',
    description: 'Ultra-fast real-time TTS (~75ms)',
    languages: [
      'en', 'ja', 'zh', 'de', 'hi', 'fr', 'ko', 'pt', 'it', 'es', 'id', 'nl', 'tr', 'fil', 'pl', 'sv', 'bg',
      'ro', 'ar', 'cs', 'el', 'fi', 'hr', 'ms', 'sk', 'da', 'ta', 'uk', 'ru', 'hu', 'no', 'vi',
    ],
    type: 'tts',
    deprecated: false,
  },
  {
    model_id: 'eleven_flash_v2',
    description: 'Ultra-fast real-time TTS (~75ms)',
    languages: ['en'],
    type: 'tts',
    deprecated: false,
  },
  {
    model_id: 'eleven_multilingual_sts_v2',
    description: 'Multilingual speech-to-speech',
    languages: [
      'en', 'ja', 'zh', 'de', 'hi', 'fr', 'ko', 'pt', 'it', 'es', 'id', 'nl', 'tr', 'fil', 'pl', 'sv', 'bg',
      'ro', 'ar', 'cs', 'el', 'fi', 'hr', 'ms', 'sk', 'da', 'ta', 'uk', 'ru',
    ],
    type: 'sts',
    deprecated: false,
  },
  {
    model_id: 'eleven_multilingual_ttv_v2',
    description: 'Multilingual text-to-voice',
    languages: [
      'en', 'ja', 'zh', 'de', 'hi', 'fr', 'ko', 'pt', 'it', 'es', 'id', 'nl', 'tr', 'fil', 'pl', 'sv', 'bg',
      'ro', 'ar', 'cs', 'el', 'fi', 'hr', 'ms', 'sk', 'da', 'ta', 'uk', 'ru',
    ],
    type: 'tts',
    deprecated: false,
  },
  {
    model_id: 'eleven_english_sts_v2',
    description: 'English-only speech-to-speech',
    languages: ['en'],
    type: 'sts',
    deprecated: false,
  },
  {
    model_id: 'eleven_monolingual_v1',
    description: 'Deprecated monolingual model',
    languages: ['en'],
    type: 'tts',
    deprecated: true,
  },
  {
    model_id: 'eleven_multilingual_v1',
    description: 'Deprecated multilingual model',
    languages: ['en', 'fr', 'de', 'hi', 'it', 'pl', 'pt', 'es'],
    type: 'tts',
    deprecated: true,
  },
  {
    model_id: 'eleven_turbo_v2_5',
    description: 'Deprecated low-latency model',
    languages: [
      'en', 'ja', 'zh', 'de', 'hi', 'fr', 'ko', 'pt', 'it', 'es', 'id', 'nl', 'tr', 'fil', 'pl', 'sv', 'bg',
      'ro', 'ar', 'cs', 'el', 'fi', 'hr', 'ms', 'sk', 'da', 'ta', 'uk', 'ru', 'hu', 'no', 'vi',
    ],
    type: 'tts',
    deprecated: true,
  },
  {
    model_id: 'eleven_turbo_v2',
    description: 'Deprecated low-latency model',
    languages: ['en'],
    type: 'tts',
    deprecated: true,
  },
];

function toCostString(v: number): string {
  return v.toFixed(4);
}

function idForRow(prefix: string, value: string): string {
  return `${prefix}:${value}`.toLowerCase();
}

export function defaultLlmCostRows(): ModelCostRow[] {
  return LLM_SEED.map((row) => ({
    id: idForRow('llm', `${row.provider}-${row.model}`),
    provider: row.provider,
    model: row.model,
    latency: row.latency,
    costPerMin: toCostString(row.costPerMin),
    languages: row.languages,
  }));
}

export function defaultTtsCostRows(): ModelCostRow[] {
  return TTS_SEED.filter((row) => row.type === 'tts').map((row) => ({
    id: idForRow('tts', row.model_id),
    provider: 'ElevenLabs',
    model: row.model_id,
    latency: '',
    costPerMin: '',
    languages: Array.isArray(row.languages) ? row.languages.join(', ') : row.languages,
    deprecated: row.deprecated,
  }));
}

/** Union of all ISO-style codes from TTS seed arrays (sorted), for multi-select in cost tables. */
function buildSelectableLanguageCodes(): string[] {
  const s = new Set<string>();
  for (const row of TTS_SEED) {
    if (!Array.isArray(row.languages)) continue;
    for (const c of row.languages) {
      const t = String(c).trim().toLowerCase();
      if (t) s.add(t);
    }
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

export const SELECTABLE_LANGUAGE_CODES: readonly string[] = buildSelectableLanguageCodes();

export function parseLatencyMs(value: string): number | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  if (raw.endsWith('ms')) return n;
  if (raw.endsWith('s')) return n * 1000;
  if (raw.endsWith('m')) return n * 60000;
  return n;
}

export function parseCostPerMin(value: string): number | null {
  const n = Number.parseFloat(String(value || '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function costPerHour(costPerMin: string): number | null {
  const v = parseCostPerMin(costPerMin);
  if (v === null) return null;
  return v * 60;
}

function normalizeKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function providerFits(rowProvider: string, providerHint?: string): boolean {
  if (!providerHint) return true;
  return normalizeKey(rowProvider) === normalizeKey(providerHint);
}

export function resolveLlmCostRow(
  rows: readonly ModelCostRow[],
  modelId: string,
  label: string,
  providerHint?: string
): ModelCostRow | null {
  const idN = normalizeKey(modelId);
  const labelN = normalizeKey(label);
  let best: { row: ModelCostRow; score: number } | null = null;
  for (const row of rows) {
    if (!providerFits(row.provider, providerHint)) continue;
    const rowN = normalizeKey(row.model);
    if (!rowN) continue;
    let score = 0;
    if (rowN === labelN || rowN === idN) score += 5;
    if (labelN && (labelN.includes(rowN) || rowN.includes(labelN))) score += 3;
    if (idN && (idN.includes(rowN) || rowN.includes(idN))) score += 2;
    if (providerHint && providerFits(row.provider, providerHint)) score += 1;
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { row, score };
    }
  }
  return best?.row ?? null;
}

export function resolveTtsCostRow(rows: readonly ModelCostRow[], modelId: string): ModelCostRow | null {
  const key = normalizeKey(modelId);
  if (!key) return null;
  return rows.find((row) => normalizeKey(row.model) === key) ?? null;
}
