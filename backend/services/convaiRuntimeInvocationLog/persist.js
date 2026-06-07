/**
 * Persistenza JSON rolling log invocazioni runtime ConvAI.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOG_PATH =
  typeof process.env.OMNIA_CONVAI_RUNTIME_LOG_PATH === 'string' &&
  process.env.OMNIA_CONVAI_RUNTIME_LOG_PATH.trim()
    ? process.env.OMNIA_CONVAI_RUNTIME_LOG_PATH.trim()
    : path.join(__dirname, '..', '..', 'data', 'convai_runtime_invocations.json');

const MAX_RECORDS = 300;
const DEFAULT_BODY_PREVIEW_CHARS = 16384;

function ensureDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function emptyLog() {
  return { records: [], meta: { schemaVersion: 2, updatedAt: null } };
}

function readLog() {
  try {
    if (!fs.existsSync(LOG_PATH)) return emptyLog();
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    const j = JSON.parse(raw);
    return {
      records: Array.isArray(j.records) ? j.records : [],
      meta:
        j.meta && typeof j.meta === 'object'
          ? { schemaVersion: 2, updatedAt: j.meta.updatedAt ?? null }
          : { schemaVersion: 2, updatedAt: null },
    };
  } catch {
    return emptyLog();
  }
}

function writeLog(payload) {
  ensureDir();
  const out = {
    records: payload.records || [],
    meta: { schemaVersion: 2, updatedAt: new Date().toISOString() },
  };
  fs.writeFileSync(LOG_PATH, JSON.stringify(out, null, 2), 'utf8');
  return out;
}

function maxBodyPreviewChars() {
  const raw = process.env.OMNIA_CONVAI_RUNTIME_LOG_BODY_MAX_CHARS;
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_BODY_PREVIEW_CHARS;
}

/**
 * @param {unknown} value
 * @param {number} [maxLen]
 * @returns {string|null}
 */
function previewValue(value, maxLen) {
  const cap = maxLen ?? maxBodyPreviewChars();
  try {
    let s;
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') s = value;
    else if (Buffer.isBuffer(value)) s = value.toString('utf8');
    else s = JSON.stringify(value);
    if (s.length <= cap) return s;
    return `${s.slice(0, cap)}… (+${s.length - cap} chars)`;
  } catch (e) {
    return `[unserializable: ${e && e.message ? e.message : String(e)}]`;
  }
}

module.exports = {
  LOG_PATH,
  MAX_RECORDS,
  readLog,
  writeLog,
  previewValue,
};
