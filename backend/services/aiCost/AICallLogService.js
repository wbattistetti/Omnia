/**
 * Append-only rolling log of AI calls (last N=500), persisted to disk and exposed read-only via REST.
 *
 * Each record captures the user-facing scope (`purpose`), provider/model, token counts, computed
 * USD/EUR cost (best effort) and the call latency. The log is intentionally simple — JSON file,
 * no DB, no aggregation — to keep the dependency surface narrow and align with `iaCatalog` patterns.
 *
 * Only the in-process writer (`appendCall`) mutates the file; readers operate on snapshots so
 * concurrent reads/writes don't tear records.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_PATH = path.join(__dirname, '..', '..', 'data', 'ai_call_log.json');
const MAX_RECORDS = 500;
const FALLBACK_PURPOSE = 'Chiamata IA non categorizzata';

function ensureDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function emptyLog() {
  return { records: [], meta: { updatedAt: null } };
}

function readLog() {
  try {
    if (!fs.existsSync(LOG_PATH)) return emptyLog();
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    const j = JSON.parse(raw);
    return {
      records: Array.isArray(j.records) ? j.records : [],
      meta: j.meta && typeof j.meta === 'object' ? j.meta : { updatedAt: null },
    };
  } catch {
    return emptyLog();
  }
}

function writeLog(payload) {
  ensureDir();
  const out = {
    records: payload.records || [],
    meta: { ...(payload.meta || {}), updatedAt: new Date().toISOString() },
  };
  fs.writeFileSync(LOG_PATH, JSON.stringify(out, null, 2), 'utf8');
  return out;
}

/**
 * Append a new call record. Failures (disk I/O, JSON parse) are swallowed with a warning so a
 * crashed log never breaks the actual AI request that triggered it (single-responsibility: the
 * log is observability, not control flow).
 *
 * @param {object} entry
 * @param {string} entry.providerId
 * @param {string} entry.modelId
 * @param {string} [entry.purpose]            user-facing scope label
 * @param {number} entry.inputTokens
 * @param {number} entry.outputTokens
 * @param {number} entry.totalTokens
 * @param {number} entry.costUsd
 * @param {number|null} [entry.costEur]
 * @param {number} entry.durationMs
 * @param {boolean} entry.pricingFound
 * @param {string|null} [entry.error]
 * @param {string|null} [entry.taskId]        task instance id originating the call (null per chiamate globali)
 * @param {string|null} [entry.taskLabel]     snapshot della label del task al momento della call
 */
function appendCall(entry) {
  try {
    const log = readLog();
    const record = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      providerId: String(entry.providerId || 'unknown'),
      modelId: String(entry.modelId || 'unknown'),
      purpose:
        typeof entry.purpose === 'string' && entry.purpose.trim()
          ? entry.purpose.trim()
          : FALLBACK_PURPOSE,
      inputTokens: Number(entry.inputTokens) || 0,
      outputTokens: Number(entry.outputTokens) || 0,
      totalTokens: Number(entry.totalTokens) || 0,
      costUsd: Number.isFinite(entry.costUsd) ? entry.costUsd : 0,
      costEur: Number.isFinite(entry.costEur) ? entry.costEur : null,
      durationMs: Number.isFinite(entry.durationMs) ? entry.durationMs : 0,
      pricingFound: Boolean(entry.pricingFound),
      error: typeof entry.error === 'string' ? entry.error : null,
      taskId:
        typeof entry.taskId === 'string' && entry.taskId.trim() ? entry.taskId.trim() : null,
      taskLabel:
        typeof entry.taskLabel === 'string' && entry.taskLabel.trim()
          ? entry.taskLabel.trim()
          : null,
    };
    const next = [record, ...log.records].slice(0, MAX_RECORDS);
    writeLog({ records: next });
    return record;
  } catch (err) {
    console.warn('[aiCost:log] appendCall failed:', err.message);
    return null;
  }
}

/** Returns the last N records (newest first). */
function listCalls({ limit } = {}) {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.min(limit, MAX_RECORDS) : MAX_RECORDS;
  return readLog().records.slice(0, cap);
}

function clearCalls() {
  writeLog({ records: [] });
}

module.exports = {
  LOG_PATH,
  MAX_RECORDS,
  appendCall,
  listCalls,
  clearCalls,
  readLog,
};
