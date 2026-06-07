/**
 * Sessione binding + stato inform dialogo KB keyed by project + agent + conversation + documento.
 */

'use strict';

const crypto = require('crypto');
const { emptyInformState, cloneInformState } = require('./kbDialogSelectorSemantics');

const KEY_PREFIX = 'omnia:dialog:v1:';
const DEFAULT_TTL_SEC = Number(process.env.OMNIA_DIALOG_STEP_TTL_SEC || 86400);

/** @type {Map<string, { binding: Record<string, string>, informState: object, expiresAt: number }>} */
const memoryStore = new Map();

/** @type {import('redis').RedisClientType | null} */
let redisClient = null;
let redisConnectPromise = null;

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
      client.on('error', () => {});
      await client.connect();
      redisClient = client;
      return client;
    } catch {
      return null;
    } finally {
      redisConnectPromise = null;
    }
  })();
  return redisConnectPromise;
}

function sessionKey(scope) {
  const raw = [
    scope.projectId,
    scope.agentTaskId,
    scope.conversationId,
    scope.kbDocumentId,
  ].join('|');
  return `${KEY_PREFIX}${crypto.createHash('sha256').update(raw, 'utf8').digest('hex')}`;
}

function pruneMemory() {
  const now = Date.now();
  for (const [k, v] of memoryStore.entries()) {
    if (v.expiresAt <= now) memoryStore.delete(k);
  }
}

function normalizeSessionPayload(parsed) {
  const binding =
    parsed && typeof parsed.binding === 'object' && !Array.isArray(parsed.binding)
      ? parsed.binding
      : {};
  const informState = cloneInformState(parsed?.informState ?? emptyInformState());
  return { binding, informState };
}

/**
 * @param {{ projectId: string, agentTaskId: string, conversationId: string, kbDocumentId: string }} scope
 */
async function loadDialogSession(scope) {
  const key = sessionKey(scope);
  const redis = await getRedisOptional();
  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit) {
        return normalizeSessionPayload(JSON.parse(hit));
      }
    } catch {
      /* fallback memory */
    }
  }
  pruneMemory();
  const mem = memoryStore.get(key);
  if (!mem || mem.expiresAt <= Date.now()) {
    return { binding: {}, informState: emptyInformState() };
  }
  return {
    binding: { ...mem.binding },
    informState: cloneInformState(mem.informState),
  };
}

/** @deprecated use loadDialogSession */
async function loadDialogBinding(scope) {
  const session = await loadDialogSession(scope);
  return session.binding;
}

/**
 * @param {{ projectId: string, agentTaskId: string, conversationId: string, kbDocumentId: string }} scope
 * @param {Record<string, string>} binding
 * @param {object} [informState]
 */
async function saveDialogSession(scope, binding, informState) {
  const key = sessionKey(scope);
  const payload = JSON.stringify({
    binding,
    informState: cloneInformState(informState ?? emptyInformState()),
  });
  const redis = await getRedisOptional();
  if (redis) {
    try {
      await redis.setEx(key, DEFAULT_TTL_SEC, payload);
      return;
    } catch {
      /* fallback memory */
    }
  }
  memoryStore.set(key, {
    binding: { ...binding },
    informState: cloneInformState(informState ?? emptyInformState()),
    expiresAt: Date.now() + DEFAULT_TTL_SEC * 1000,
  });
}

/** @deprecated use saveDialogSession */
async function saveDialogBinding(scope, binding) {
  const session = await loadDialogSession(scope);
  await saveDialogSession(scope, binding, session.informState);
}

/**
 * @param {{ projectId: string, agentTaskId: string, conversationId: string, kbDocumentId: string }} scope
 */
async function clearDialogBinding(scope) {
  const key = sessionKey(scope);
  const redis = await getRedisOptional();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      /* ignore */
    }
  }
  memoryStore.delete(key);
}

module.exports = {
  loadDialogSession,
  saveDialogSession,
  loadDialogBinding,
  saveDialogBinding,
  clearDialogBinding,
  sessionKey,
};
