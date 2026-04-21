/**
 * Sync ElevenLabs voices, derived + global languages, and LLM model lists (no ElevenLabs LLM).
 */

const { readCache, writeCache, CACHE_PATH } = require('./fileCache');
const pg = require('./pgStore');
const { diag } = require('./catalogLog');
const { getElevenLabsBaseUrl } = require('./elevenLabsEndpoint');

/** BCP-47 locales to merge for “global” API language hints (not from EL). */
const GLOBAL_LOCALE_EXTRAS = [
  { locale: 'en-US', label: 'English (US)' },
  { locale: 'en-GB', label: 'English (UK)' },
  { locale: 'it-IT', label: 'Italiano' },
  { locale: 'fr-FR', label: 'Français' },
  { locale: 'de-DE', label: 'Deutsch' },
  { locale: 'es-ES', label: 'Español' },
  { locale: 'pt-BR', label: 'Português (Brasil)' },
  { locale: 'ja-JP', label: '日本語' },
];

function mapElevenLabsVoice(v) {
  const labels = v.labels && typeof v.labels === 'object' ? v.labels : {};
  const lang =
    typeof labels.language === 'string'
      ? labels.language
      : typeof v.fine_tuning?.language === 'string'
        ? v.fine_tuning.language
        : null;
  const accentStr = typeof labels.accent === 'string' ? labels.accent : null;
  const tags = [];
  if (accentStr) tags.push(accentStr);
  if (typeof labels.use_case === 'string') tags.push(labels.use_case);
  if (Array.isArray(v.tags)) {
    for (const t of v.tags) if (typeof t === 'string') tags.push(t);
  }
  const expressive =
    Array.isArray(v.highlights) ? v.highlights.map((h) => (typeof h === 'string' ? h : h?.text)).filter(Boolean) : [];
  const description =
    typeof v.description === 'string'
      ? v.description
      : typeof labels.description === 'string'
        ? labels.description
        : null;
  const voice_description = typeof labels.voice_description === 'string' ? labels.voice_description : null;
  const style = typeof labels.style === 'string' ? labels.style : null;
  const age_group =
    typeof labels.age === 'string'
      ? labels.age
      : typeof labels.age_group === 'string'
        ? labels.age_group
        : null;
  return {
    voice_id: v.voice_id || v.voiceId,
    name: v.name || v.voice_id || 'voice',
    preview_url: v.preview_url || null,
    language: lang || 'und',
    gender: typeof labels.gender === 'string' ? labels.gender : null,
    category: v.category || 'premade',
    accent: accentStr,
    age_group,
    description,
    voice_description,
    style,
    provider: 'elevenlabs',
    tags:
      tags.length > 0
        ? tags
        : Array.isArray(v.verified_languages)
          ? v.verified_languages
              .map((x) => (typeof x === 'string' ? x : x?.language || ''))
              .filter(Boolean)
          : [],
    tts_family:
      typeof v.category === 'string' && v.category.includes('turbo')
        ? 'Turbo'
        : v.labels?.description || 'ElevenLabs',
    expressive_tags: expressive,
    raw: v,
  };
}

async function syncVoicesElevenLabs() {
  const rawKey = process.env.ELEVENLABS_API_KEY;
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  diag('syncVoices:start', {
    elevenLabsKeyPresent: Boolean(key),
    elevenLabsKeyCharCount: key.length,
    postgresUrlConfigured: pg.isDbConfigured(),
    cacheFilePath: CACHE_PATH,
  });

  if (!key) {
    console.warn('[iaCatalog] ELEVENLABS_API_KEY missing — skip voice sync');
    diag('syncVoices:abort', { reason: 'no_api_key' });
    return { ok: false, count: 0, error: 'no_api_key' };
  }

  const elevenBase = getElevenLabsBaseUrl();
  diag('syncVoices:endpoint', { elevenBase });

  const res = await fetch(`${elevenBase}/voices`, {
    headers: { 'xi-api-key': key },
  });

  if (!res.ok) {
    const t = await res.text();
    diag('syncVoices:http_error', {
      httpStatus: res.status,
      bodyPreview: t.slice(0, 240),
    });
    try {
      const cc = readCache();
      cc.meta = cc.meta || {};
      cc.meta.voicesSyncState = {
        ok: false,
        at: new Date().toISOString(),
        httpStatus: res.status,
        errorPreview: t.slice(0, 120),
      };
      writeCache(cc);
    } catch (persistErr) {
      console.warn('[iaCatalog] voicesSyncState persist failed:', String(persistErr?.message || persistErr));
    }
    throw new Error(`ElevenLabs voices HTTP ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = await res.json();
  const list = Array.isArray(data.voices) ? data.voices : [];
  const rows = list.map(mapElevenLabsVoice).filter((r) => r.voice_id);

  diag('syncVoices:api_ok', {
    httpStatus: res.status,
    rawVoiceCountFromApi: list.length,
    mappedVoiceRows: rows.length,
    droppedWithoutVoiceId: list.length - rows.length,
  });

  if (list.length === 0) {
    diag('syncVoices:warn_empty_account', {
      hint: 'GET /v1/voices ha restituito lista vuota per questa chiave API (account senza voci create / libreria vuota).',
    });
  }

  const pool = pg.getPool();
  diag('syncVoices:persistence', {
    postgresPoolActive: Boolean(pool),
    willUpsertPostgres: Boolean(pool && rows.length),
    willWriteFileCache: rows.length >= 0,
  });

  await pg.upsertVoices(rows);
  const c = readCache();
  c.voices = rows;
  c.meta = c.meta || {};
  c.meta.voicesSyncState = {
    ok: true,
    at: new Date().toISOString(),
    apiVoiceCount: list.length,
    mappedCount: rows.length,
    emptyApiList: list.length === 0,
  };
  writeCache(c);

  diag('syncVoices:done', {
    voicesWrittenToCache: rows.length,
    cachePath: CACHE_PATH,
  });
  diag('syncVoices:ok', {
    count: rows.length,
    apiVoiceCount: list.length,
    emptyApiList: list.length === 0,
  });

  return { ok: true, count: rows.length };
}

function deriveLanguagesFromVoices(voiceRows) {
  const set = new Map();
  for (const v of voiceRows) {
    const loc = v.language || 'und';
    if (!set.has(loc)) {
      set.set(loc, { locale: loc, label: loc, sources: ['elevenlabs_voices'] });
    }
  }
  for (const g of GLOBAL_LOCALE_EXTRAS) {
    if (!set.has(g.locale)) {
      set.set(g.locale, { locale: g.locale, label: g.label, sources: ['global_extra'] });
    } else {
      const cur = set.get(g.locale);
      cur.sources = Array.from(new Set([...cur.sources, 'global_extra']));
      cur.label = g.label || cur.label;
    }
  }
  return [...set.values()].sort((a, b) => a.locale.localeCompare(b.locale));
}

async function syncLanguages() {
  let voices = await pg.readVoicesFromDb();
  if (!voices.length) {
    const c = readCache();
    voices = c.voices || [];
  }
  if (!voices.length) {
    const r = await syncVoicesElevenLabs();
    if (r.ok) voices = readCache().voices || [];
  }
  const langs = deriveLanguagesFromVoices(voices);
  await pg.upsertLanguages(langs);
  const c = readCache();
  c.languages = langs;
  c.meta = c.meta || {};
  c.meta.lastLanguagesSync = new Date().toISOString();
  writeCache(c);
  return { ok: true, count: langs.length };
}

async function fetchOpenAIModels() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`OpenAI models ${res.status}`);
  const data = await res.json();
  const rows = [];
  for (const m of data.data || []) {
    if (!m.id) continue;
    const id = m.id;
    const isNew = id.includes('preview') || id.includes('gpt-5');
    const tagList = [];
    if (isNew) tagList.push('preview');
    if (id.includes('gpt-5') || id.includes('2025') || id.includes('4.1')) tagList.push('new');
    rows.push({
      model_id: id,
      name: id,
      latency_ms: null,
      cost_hint: id.includes('gpt-4') || id.includes('o1') ? '$$$' : '$',
      capabilities: {},
      tags: tagList,
      notes: isNew ? 'Preview / check provider' : null,
      raw: m,
    });
  }
  rows.sort((a, b) => a.model_id.localeCompare(b.model_id));
  return rows;
}

async function fetchAnthropicModels() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) {
      console.warn('[iaCatalog] Anthropic /v1/models not available:', res.status);
      return fallbackAnthropicModels();
    }
    const data = await res.json();
    const rows = [];
    const list = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
    for (const m of list) {
      const id = m.id || m.model_id || m.name;
      if (!id) continue;
      rows.push({
        model_id: id,
        name: typeof m.display_name === 'string' ? m.display_name : id,
        latency_ms: null,
        cost_hint: '$$',
        capabilities: {},
        tags: [],
        notes: null,
        raw: m,
      });
    }
    if (!rows.length) return fallbackAnthropicModels();
    return rows;
  } catch (e) {
    console.warn('[iaCatalog] Anthropic models fetch failed:', e.message);
    return fallbackAnthropicModels();
  }
}

function fallbackAnthropicModels() {
  return ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'].map((id) => ({
    model_id: id,
    name: id,
    latency_ms: null,
    cost_hint: '$$',
    capabilities: {},
    tags: [],
    notes: 'fallback list',
    raw: {},
  }));
}

async function fetchGoogleModels() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return [];
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google models ${res.status}`);
  const data = await res.json();
  const rows = [];
  for (const m of data.models || []) {
    const name = m.name || '';
    const short = name.includes('/') ? name.split('/').pop() : name;
    if (!short || m.supportedGenerationMethods?.includes('generateContent') === false) continue;
    rows.push({
      model_id: short,
      name: short,
      latency_ms: null,
      cost_hint: short.includes('flash') ? '$' : '$$',
      capabilities: {},
      tags: [],
      notes: null,
      raw: m,
    });
  }
  rows.sort((a, b) => a.model_id.localeCompare(b.model_id));
  return rows;
}

async function syncModelsLLM() {
  const openai = await fetchOpenAIModels();
  const anthropic = await fetchAnthropicModels();
  const google = await fetchGoogleModels();

  await pg.upsertModels('openai', openai);
  await pg.upsertModels('anthropic', anthropic);
  await pg.upsertModels('google', google);

  const c = readCache();
  c.modelsByProvider = {
    openai,
    anthropic,
    google,
  };
  c.meta = c.meta || {};
  c.meta.lastModelsSync = new Date().toISOString();
  writeCache(c);

  return {
    ok: true,
    counts: {
      openai: openai.length,
      anthropic: anthropic.length,
      google: google.length,
    },
  };
}

async function syncAll() {
  const results = {};
  try {
    results.voices = await syncVoicesElevenLabs();
  } catch (e) {
    results.voices = { ok: false, error: String(e.message || e) };
  }
  try {
    results.languages = await syncLanguages();
  } catch (e) {
    results.languages = { ok: false, error: String(e.message || e) };
  }
  try {
    results.models = await syncModelsLLM();
  } catch (e) {
    results.models = { ok: false, error: String(e.message || e) };
  }
  return results;
}

function filterList(list, q) {
  if (!q || typeof q !== 'string') return list;
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((item) => {
    const blob = JSON.stringify(item).toLowerCase();
    return blob.includes(s);
  });
}

module.exports = {
  syncVoicesElevenLabs,
  syncLanguages,
  syncModelsLLM,
  syncAll,
  deriveLanguagesFromVoices,
  filterList,
};
