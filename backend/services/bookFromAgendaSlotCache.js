/**
 * Persistenza snapshot UniversalAgenda per BookFromAgenda (Redis).
 * Prima materializzazione da agenda.url / agenda.json → salva per scope; chiamate successive
 * con stesso scope riusano lo snapshot (no refetch) salvo `forceRefresh` o fingerprint sorgente cambiato.
 */

'use strict';

const crypto = require('crypto');

const KEY_PREFIX = 'omnia:bfa:v1:';
const DEFAULT_TTL_SEC = Number(process.env.BOOKFROMAGENDA_CACHE_TTL_SEC || 86400);

/** @type {import('redis').RedisClientType | null} */
let redisClient = null;
/** @type {Promise<import('redis').RedisClientType | null> | null} */
let redisConnectPromise = null;

/**
 * @returns {Promise<import('redis').RedisClientType | null>}
 */
async function getRedisOptional() {
  try {
    require.resolve('redis');
  } catch {
    return null;
  }

  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.ping();
      return redisClient;
    } catch {
      redisClient = null;
    }
  }

  if (redisConnectPromise) return redisConnectPromise;

  redisConnectPromise = (async () => {
    try {
      const { createClient } = require('redis');
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      const client = createClient({ url });
      client.on('error', (err) => {
        console.warn('[BookFromAgenda cache] Redis client error:', err.message);
      });
      await client.connect();
      redisClient = client;
      return client;
    } catch (e) {
      console.warn('[BookFromAgenda cache] Redis unavailable — caching disabled:', e.message);
      return null;
    } finally {
      redisConnectPromise = null;
    }
  })();

  return redisConnectPromise;
}

function sha256hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * Chiave Redis stabile per scope (conversation + progetto).
 * @param {string} scopeId
 */
function redisKey(scopeId) {
  const h = sha256hex(scopeId);
  return `${KEY_PREFIX}${h}`;
}

/**
 * Chiave Redis effettiva per uno scope logico (debug / log).
 * @param {string} scopeId risultato di {@link buildScopePersistenceKey}
 * @returns {string}
 */
function getRedisStorageKey(scopeId) {
  if (!scopeId || typeof scopeId !== 'string') return '';
  return redisKey(scopeId);
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} fieldName
 * @returns {string}
 */
function readRequiredScopeString(body, fieldName) {
  if (!(fieldName in body)) {
    throw new Error(`bookfromagenda: missing required field "${fieldName}"`);
  }
  const v = body[fieldName];
  if (typeof v !== 'string') {
    throw new Error(`bookfromagenda: "${fieldName}" must be a string`);
  }
  return v.trim();
}

/**
 * Chiave logica di persistenza (prima dell’hash Redis): solo conversationId + projectId (camelCase).
 * Stringhe vuote ammesse per dimensioni non usate; se entrambe vuote → nessuno scope cache.
 *
 * @param {Record<string, unknown>} body
 * @returns {string}
 */
function buildScopePersistenceKey(body) {
  const c = readRequiredScopeString(body, 'conversationId');
  const p = readRequiredScopeString(body, 'projectId');
  if (!c && !p) return '';
  return `c:${c}|p:${p}`;
}

/**
 * @param {Record<string, unknown>} body
 * @returns {boolean}
 */
function extractForceRefresh(body) {
  if (!('forceRefresh' in body)) {
    /** Default: prima materializzazione (con sorgente agenda) → true; follow-up solo filtri → false. */
    return hasAgendaSource(body);
  }
  const v = body.forceRefresh;
  if (v !== true && v !== false) {
    throw new Error('bookfromagenda: forceRefresh must be a boolean');
  }
  return v;
}

/**
 * @param {Record<string, unknown>} body
 */
function hasAgendaSource(body) {
  const j = body['agenda.json'];
  const u = typeof body['agenda.url'] === 'string' ? body['agenda.url'].trim() : '';
  return (j !== undefined && j !== null) || u.length > 0;
}

/**
 * Impronta della sorgente agenda per invalidazione quando cambia URL/JSON.
 * @param {Record<string, unknown>} body
 */
function fingerprintFromBody(body) {
  const url = typeof body['agenda.url'] === 'string' ? body['agenda.url'].trim() : '';
  const j = body['agenda.json'];
  if (url.length > 0) {
    const t = String(body['agenda.type'] || '').trim();
    return sha256hex(`url:${url}|type:${t}`);
  }
  if (j !== undefined && j !== null) {
    const canon = typeof j === 'object' ? JSON.stringify(j) : String(j);
    return sha256hex(`json:${canon}`);
  }
  throw new Error('bookfromagenda: internal — fingerprint requires agenda source');
}

/**
 * @param {string} scopeId
 * @returns {Promise<{ sourceFingerprint: string, universalAgenda: unknown, savedAt: number } | null>}
 */
async function loadCachedAgenda(scopeId) {
  const redis = await getRedisOptional();
  if (!redis || !scopeId) return null;
  try {
    const raw = await redis.get(redisKey(scopeId));
    if (!raw || typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const fp = parsed.sourceFingerprint;
    const agenda = parsed.universalAgenda;
    const savedAt = Number(parsed.savedAt) || 0;
    if (typeof fp !== 'string' || !fp || agenda === undefined || agenda === null) return null;
    return { sourceFingerprint: fp, universalAgenda: agenda, savedAt };
  } catch (e) {
    console.warn('[BookFromAgenda cache] load failed:', e.message);
    return null;
  }
}

/**
 * @param {string} scopeId
 * @param {string} sourceFingerprint
 * @param {unknown} universalAgenda
 * @param {number} [ttlSec]
 */
async function saveCachedAgenda(scopeId, sourceFingerprint, universalAgenda, ttlSec = DEFAULT_TTL_SEC) {
  const redis = await getRedisOptional();
  if (!redis || !scopeId) return;
  const ttl = Number.isFinite(ttlSec) && ttlSec > 0 ? Math.floor(ttlSec) : DEFAULT_TTL_SEC;
  const payload = JSON.stringify({
    sourceFingerprint,
    universalAgenda,
    savedAt: Date.now(),
  });
  try {
    await redis.set(redisKey(scopeId), payload, { EX: ttl });
  } catch (e) {
    console.warn('[BookFromAgenda cache] save failed:', e.message);
  }
}

module.exports = {
  buildScopePersistenceKey,
  extractForceRefresh,
  hasAgendaSource,
  fingerprintFromBody,
  loadCachedAgenda,
  saveCachedAgenda,
  getRedisOptional,
  getRedisStorageKey,
  DEFAULT_TTL_SEC,
};
