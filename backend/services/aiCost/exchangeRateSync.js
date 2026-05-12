/**
 * USD -> EUR daily exchange rate, fetched from frankfurter.dev (ECB reference rates, free, no API key).
 *
 * - Cached on disk; refreshed at most once per `REFRESH_INTERVAL_MS`.
 * - When the network call fails, we keep returning the last cached value (resilient to outages).
 * - When no cache exists yet, `getUsdToEur()` returns `null` (the cost calculator omits `costEur`
 *   in that case, but never throws — single responsibility: this module deals with FX only).
 */

const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'exchange_rate_cache.json');
const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR';
const FETCH_TIMEOUT_MS = 8000;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

function ensureDir() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const raw = fs.readFileSync(CACHE_PATH, 'utf8');
    const j = JSON.parse(raw);
    if (typeof j.usdToEur !== 'number' || !Number.isFinite(j.usdToEur)) return null;
    return {
      usdToEur: j.usdToEur,
      fetchedAt: typeof j.fetchedAt === 'string' ? j.fetchedAt : null,
      ecbDate: typeof j.ecbDate === 'string' ? j.ecbDate : null,
    };
  } catch {
    return null;
  }
}

function writeCache(entry) {
  ensureDir();
  fs.writeFileSync(CACHE_PATH, JSON.stringify(entry, null, 2), 'utf8');
  return entry;
}

async function fetchLatestUsdToEur() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(FRANKFURTER_URL, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    throw new Error(`Frankfurter HTTP ${res.status}`);
  }
  const data = await res.json();
  const rate = Number(data?.rates?.EUR);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Frankfurter response missing EUR rate');
  }
  return writeCache({
    usdToEur: rate,
    fetchedAt: new Date().toISOString(),
    ecbDate: typeof data.date === 'string' ? data.date : null,
  });
}

let inFlight = null;

/**
 * Returns the cached USD->EUR rate, refreshing at most once per 24h. Failures during refresh are
 * swallowed (we keep serving the previous value). Returns `null` if no cache and the first fetch fails.
 */
async function getUsdToEur() {
  const cached = readCache();
  const now = Date.now();
  const isStale =
    !cached || !cached.fetchedAt || now - new Date(cached.fetchedAt).getTime() > REFRESH_INTERVAL_MS;

  if (!isStale && cached) return cached.usdToEur;

  if (!inFlight) {
    inFlight = fetchLatestUsdToEur()
      .catch((err) => {
        console.warn('[aiCost:fx] frankfurter refresh failed:', err.message);
        return null;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  const fresh = await inFlight;
  if (fresh) return fresh.usdToEur;
  return cached ? cached.usdToEur : null;
}

/** Synchronous helper for the cost calculator: returns the cached rate (or `null`) without I/O. */
function getCachedUsdToEur() {
  const cached = readCache();
  return cached ? cached.usdToEur : null;
}

module.exports = {
  CACHE_PATH,
  getUsdToEur,
  getCachedUsdToEur,
  fetchLatestUsdToEur,
  readCache,
};
