/**
 * Rolling log of ConvAI webhook gateway invocations (ElevenLabs → Omnia gateway → upstream backend).
 * Persisted to JSON; exposed read-only via REST for the Task Editor guardalog panel.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_PATH =
  typeof process.env.OMNIA_CONVAI_WEBHOOK_LOG_PATH === 'string' &&
  process.env.OMNIA_CONVAI_WEBHOOK_LOG_PATH.trim()
    ? process.env.OMNIA_CONVAI_WEBHOOK_LOG_PATH.trim()
    : path.join(__dirname, '..', 'data', 'convai_webhook_invocations.json');
const MAX_RECORDS = 300;
const DEFAULT_BODY_PREVIEW_CHARS = 16384;

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

function maxBodyPreviewChars() {
  const raw = process.env.OMNIA_CONVAI_WEBHOOK_LOG_BODY_MAX_CHARS;
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_BODY_PREVIEW_CHARS;
}

/**
 * @param {unknown} value
 * @param {number} [maxLen]
 */
function previewValue(value, maxLen) {
  const cap = maxLen ?? maxBodyPreviewChars();
  try {
    let s;
    if (value === undefined) return null;
    if (typeof value === 'string') s = value;
    else if (Buffer.isBuffer(value)) s = value.toString('utf8');
    else s = JSON.stringify(value);
    if (s.length <= cap) return s;
    return `${s.slice(0, cap)}… (+${s.length - cap} chars)`;
  } catch (e) {
    return `[unserializable: ${e && e.message ? e.message : String(e)}]`;
  }
}

/**
 * @param {object} entry
 */
function appendInvocation(entry) {
  try {
    const log = readLog();
    const record = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      projectId: String(entry.projectId ?? '').trim() || null,
      agentTaskId: String(entry.agentTaskId ?? '').trim() || null,
      backendTaskId: String(entry.backendTaskId ?? '').trim() || null,
      backendLabel:
        typeof entry.backendLabel === 'string' && entry.backendLabel.trim()
          ? entry.backendLabel.trim()
          : null,
      gatewayPath:
        typeof entry.gatewayPath === 'string' && entry.gatewayPath.trim()
          ? entry.gatewayPath.trim()
          : null,
      upstreamUrl:
        typeof entry.upstreamUrl === 'string' && entry.upstreamUrl.trim()
          ? entry.upstreamUrl.trim()
          : null,
      forwardMethod: String(entry.forwardMethod ?? 'POST').trim().toUpperCase() || 'POST',
      requestBodyFromClient: previewValue(entry.requestBodyFromClient),
      requestBodyAfterSendHints: previewValue(entry.requestBodyAfterSendHints),
      upstreamStatus: Number.isFinite(entry.upstreamStatus) ? entry.upstreamStatus : null,
      upstreamResponsePreview: previewValue(entry.upstreamResponsePreview),
      durationMs: Number.isFinite(entry.durationMs) ? entry.durationMs : 0,
      sendHintsApplied: Number.isFinite(entry.sendHintsApplied) ? entry.sendHintsApplied : 0,
      error: typeof entry.error === 'string' && entry.error.trim() ? entry.error.trim() : null,
    };
    const next = [record, ...log.records].slice(0, MAX_RECORDS);
    writeLog({ records: next });
    return record;
  } catch (err) {
    console.warn('[convai-webhook-log] appendInvocation failed:', err.message);
    return null;
  }
}

/**
 * @param {object} [filters]
 * @param {string} [filters.projectId]
 * @param {string} [filters.agentTaskId]
 * @param {string} [filters.backendTaskId]
 * @param {number} [filters.limit]
 */
function listInvocations(filters = {}) {
  const cap =
    Number.isFinite(filters.limit) && filters.limit > 0
      ? Math.min(filters.limit, MAX_RECORDS)
      : MAX_RECORDS;
  const projectId = String(filters.projectId ?? '').trim();
  const agentTaskId = String(filters.agentTaskId ?? '').trim();
  const backendTaskId = String(filters.backendTaskId ?? '').trim();

  let rows = readLog().records;
  if (projectId) rows = rows.filter((r) => r.projectId === projectId);
  if (agentTaskId) rows = rows.filter((r) => r.agentTaskId === agentTaskId);
  if (backendTaskId) rows = rows.filter((r) => r.backendTaskId === backendTaskId);
  return rows.slice(0, cap);
}

function clearInvocations() {
  writeLog({ records: [] });
}

module.exports = {
  LOG_PATH,
  MAX_RECORDS,
  appendInvocation,
  listInvocations,
  clearInvocations,
  readLog,
  previewValue,
};
