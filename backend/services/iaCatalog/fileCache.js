/**
 * Local JSON fallback when Postgres is unavailable or UI read fails after sync.
 */

const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'ia_catalog_cache.json');

function ensureDir() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const EMPTY_MODELS_BY_PROVIDER = Object.freeze({
  openai: [],
  groq: [],
  anthropic: [],
  google: [],
  elevenlabs: [],
});

function freshModelsByProvider() {
  return { ...EMPTY_MODELS_BY_PROVIDER };
}

function emptyCache() {
  return {
    voices: [],
    languages: [],
    modelsByProvider: freshModelsByProvider(),
    meta: { updatedAt: null },
  };
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return emptyCache();
    const raw = fs.readFileSync(CACHE_PATH, 'utf8');
    const j = JSON.parse(raw);
    const modelsByProvider =
      j.modelsByProvider && typeof j.modelsByProvider === 'object'
        ? { ...freshModelsByProvider(), ...j.modelsByProvider }
        : freshModelsByProvider();
    return {
      voices: Array.isArray(j.voices) ? j.voices : [],
      languages: Array.isArray(j.languages) ? j.languages : [],
      modelsByProvider,
      meta: j.meta && typeof j.meta === 'object' ? j.meta : { updatedAt: null },
    };
  } catch {
    return emptyCache();
  }
}

function writeCache(data) {
  ensureDir();
  const payload = {
    voices: data.voices ?? [],
    languages: data.languages ?? [],
    modelsByProvider: {
      ...freshModelsByProvider(),
      ...(data.modelsByProvider ?? {}),
    },
    meta: {
      ...data.meta,
      updatedAt: new Date().toISOString(),
    },
  };
  fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

module.exports = {
  CACHE_PATH,
  readCache,
  writeCache,
  emptyCache,
};
