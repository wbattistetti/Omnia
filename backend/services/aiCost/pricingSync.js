/**
 * Pricing sync — fetch live LLM prices from OpenRouter.
 *
 * OpenRouter expose `GET https://openrouter.ai/api/v1/models` (no API key required for the
 * public list) returning, per model: `id` (`provider/model`), `pricing.prompt`, `pricing.completion`
 * in USD per token (string). We normalize to USD-per-million-tokens for arithmetic stability.
 *
 * The catalog is cached on disk to keep the UI responsive when offline; the same pattern as
 * `backend/services/iaCatalog/fileCache.js` (rolling, idempotent JSON write).
 *
 * Provider mapping: OpenRouter prefixes ids with the upstream slug (`openai/gpt-5`, `groq/llama-3.3-70b`,
 * `anthropic/claude-...`, `google/gemini-...`). We index by `(providerId, modelId)` so the cost
 * calculator can look up by the exact model id used in `AIProviderService.callAI`.
 */

const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'ia_pricing_cache.json');
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const SYNC_TIMEOUT_MS = 15000;

const PROVIDER_PREFIX = Object.freeze({
  openai: 'openai',
  groq: 'groq',
  anthropic: 'anthropic',
  google: 'google',
});

function ensureDir() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function emptyCache() {
  return { items: [], byKey: {}, meta: { updatedAt: null, source: null } };
}

/**
 * Reads the on-disk pricing cache. Falls back to an empty structure if the file is missing or
 * unreadable (no exceptions: the cost calculator must keep working — costs simply become 0).
 */
function readCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return emptyCache();
    const raw = fs.readFileSync(CACHE_PATH, 'utf8');
    const j = JSON.parse(raw);
    return {
      items: Array.isArray(j.items) ? j.items : [],
      byKey: j.byKey && typeof j.byKey === 'object' ? j.byKey : {},
      meta: j.meta && typeof j.meta === 'object' ? j.meta : { updatedAt: null, source: null },
    };
  } catch {
    return emptyCache();
  }
}

function writeCache(payload) {
  ensureDir();
  const out = {
    items: payload.items || [],
    byKey: payload.byKey || {},
    meta: { ...(payload.meta || {}), updatedAt: new Date().toISOString() },
  };
  fs.writeFileSync(CACHE_PATH, JSON.stringify(out, null, 2), 'utf8');
  return out;
}

function indexKey(providerId, modelId) {
  return `${providerId}::${modelId}`;
}

/**
 * Map an OpenRouter row to our internal pricing entry. Returns `null` for ids whose prefix
 * doesn't match a provider we use, or whose pricing is missing/malformed.
 */
function mapOpenRouterRow(row) {
  if (!row || typeof row !== 'object') return null;
  const fullId = typeof row.id === 'string' ? row.id : '';
  if (!fullId.includes('/')) return null;

  const [prefix, ...rest] = fullId.split('/');
  const providerId = Object.entries(PROVIDER_PREFIX).find(
    ([, slug]) => slug === prefix
  )?.[0];
  if (!providerId) return null;

  const modelId = rest.join('/');
  if (!modelId) return null;

  const pricing = row.pricing && typeof row.pricing === 'object' ? row.pricing : null;
  if (!pricing) return null;

  const promptPerToken = Number(pricing.prompt);
  const completionPerToken = Number(pricing.completion);
  if (!Number.isFinite(promptPerToken) || !Number.isFinite(completionPerToken)) return null;

  return {
    providerId,
    modelId,
    inputUsdPer1M: promptPerToken * 1_000_000,
    outputUsdPer1M: completionPerToken * 1_000_000,
    contextLength: typeof row.context_length === 'number' ? row.context_length : null,
    rawId: fullId,
  };
}

/**
 * Fetch pricing from OpenRouter and persist to the local cache. Throws on network/HTTP error so
 * the route can surface the failure (caller decides whether to keep the previous cache).
 */
async function syncPricingFromOpenRouter() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter pricing HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const payload = await res.json();
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const items = [];
  const byKey = {};
  for (const row of list) {
    const mapped = mapOpenRouterRow(row);
    if (!mapped) continue;
    items.push(mapped);
    byKey[indexKey(mapped.providerId, mapped.modelId)] = mapped;
  }
  return writeCache({
    items,
    byKey,
    meta: { source: 'openrouter', count: items.length },
  });
}

/**
 * Returns the pricing entry for `(providerId, modelId)` or `null` when we have no record
 * (e.g. brand-new model not yet in OpenRouter, free local model, etc.).
 *
 * The cost calculator treats `null` as "free / unknown" → `costUsd = 0` per user policy.
 */
function lookupPricing(providerId, modelId) {
  if (!providerId || !modelId) return null;
  const cache = readCache();
  return cache.byKey[indexKey(providerId, modelId)] || null;
}

module.exports = {
  CACHE_PATH,
  emptyCache,
  readCache,
  syncPricingFromOpenRouter,
  lookupPricing,
};
