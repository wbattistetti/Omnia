/**
 * Risolve UniversalAgenda v1 dal payload interno di bookFromAgendaService (non il body HTTP grezzo):
 * `agendaJson` da `agenda.json`, oppure `agendaUrl`/`agendaType` da `agenda.url`/`agenda.type`.
 * ICS → slot: griglia e timezone sono fissi lato server (non nel contratto pubblico).
 */

'use strict';

const { collectBusyByDate, busyMapToUniversalAgenda } = require('./bookFromAgendaIcs');
const { _internal: { parseClock } } = require('./schedulingConstraintSolver');

/** Default interni per ICS/Google/Outlook URL (non esposti nell’API pubblica). */
const INTERNAL_ICS_GRID = Object.freeze({
  dayStart: '09:00',
  dayEnd: '17:00',
  slotDurationMinutes: 30,
  slotStepMinutes: 30,
  timezone: 'Europe/Rome',
});

/** @typedef {'ICS'|'Google'|'Outlook'|'Omnia'} AgendaAdapterType */

/**
 * @param {unknown} agenda
 * @param {(a: unknown) => void} validateUniversalAgenda
 */
function normalizeAgendaJson(agenda, validateUniversalAgenda) {
  if (!agenda || typeof agenda !== 'object' || Array.isArray(agenda)) {
    throw new Error('bookfromagenda: agenda.json must be an object');
  }
  const o = /** @type {Record<string, unknown>} */ (agenda);

  if (Array.isArray(o.days)) {
    validateUniversalAgenda(agenda);
    return /** @type {object} */ (JSON.parse(JSON.stringify(agenda)));
  }

  if (typeof o.date === 'string' && Array.isArray(o.slots)) {
    const wrapped = {
      timezone: typeof o.timezone === 'string' ? o.timezone : 'Europe/Rome',
      days: [{ date: o.date, slots: o.slots }],
    };
    validateUniversalAgenda(wrapped);
    return wrapped;
  }

  throw new Error(
    'bookfromagenda: agenda.json must be UniversalAgenda (days) or { date, slots }'
  );
}

/**
 * @param {string} host
 */
function isBlockedHost(host) {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
  if (h.endsWith('.localhost')) return false;
  if (h === 'metadata.google.internal') return true;
  const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

/**
 * @param {string} urlStr
 * @param {{ maxBytes?: number, timeoutMs?: number }} [opts]
 */
async function fetchUrlSafe(urlStr, opts = {}) {
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 20000;
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error('bookfromagenda: agendaUrl is not a valid URL');
  }
  const httpsOk = u.protocol === 'https:';
  const httpLocal =
    u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  if (!httpsOk && !httpLocal) {
    throw new Error('bookfromagenda: only https URLs allowed (http only for localhost)');
  }
  if (isBlockedHost(u.hostname)) {
    throw new Error('bookfromagenda: URL hostname blocked for SSRF protection');
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(urlStr, {
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': 'Omnia-BookFromAgenda/1.0' },
    });
    if (!res.ok) throw new Error(`bookfromagenda: fetch failed HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new Error('bookfromagenda: response body too large');
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param {Record<string, unknown>} body risolto da bookFromAgendaService (horizon obbligatorio per ICS-like URL)
 * @param {(a: unknown) => void} validateUniversalAgenda
 */
async function fetchAndAdaptAgenda(urlStr, agendaTypeRaw, body, validateUniversalAgenda) {
  const agendaType = String(agendaTypeRaw || '')
    .trim()
    .toUpperCase();

  const text = await fetchUrlSafe(urlStr);

  if (agendaType === 'OMNIA') {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`bookfromagenda: Omnia URL must return JSON: ${e.message}`);
    }
    return normalizeAgendaJson(parsed, validateUniversalAgenda);
  }

  const hz = body.horizon;
  if (!hz || typeof hz !== 'object') {
    throw new Error(
      'bookfromagenda: horizon {start,end} required for ICS/Google/Outlook agenda.url (horizon.start/end or queryConstraints.horizon)'
    );
  }
  const horizonStart = String(/** @type {{start?:unknown}} */ (hz).start ?? '');
  const horizonEnd = String(/** @type {{end?:unknown}} */ (hz).end ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(horizonStart) || !/^\d{4}-\d{2}-\d{2}$/.test(horizonEnd)) {
    throw new Error('bookfromagenda: horizon.start / horizon.end must be YYYY-MM-DD');
  }

  const dayStartMin = parseClock(INTERNAL_ICS_GRID.dayStart);
  const dayEndMin = parseClock(INTERNAL_ICS_GRID.dayEnd);
  const slotDuration = INTERNAL_ICS_GRID.slotDurationMinutes;
  const slotStep = INTERNAL_ICS_GRID.slotStepMinutes;
  const timezone = INTERNAL_ICS_GRID.timezone;

  if (agendaType === 'ICS' || agendaType === 'GOOGLE' || agendaType === 'OUTLOOK') {
    const busy = collectBusyByDate(text);
    return busyMapToUniversalAgenda(busy, {
      horizonStart,
      horizonEnd,
      dayStartMin,
      dayEndMin,
      slotDuration,
      slotStep,
      timezone,
    });
  }

  throw new Error(
    `bookfromagenda: unsupported agendaType "${agendaTypeRaw}" (use ICS, Google, Outlook, Omnia)`
  );
}

/**
 * Payload da bookFromAgendaService: esattamente uno tra agendaJson | (agendaUrl + agendaType); opzionale horizon per fetch URL.
 * @param {unknown} body
 * @param {(a: unknown) => void} validateUniversalAgenda
 */
async function resolveUniversalAgenda(body, validateUniversalAgenda) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('bookfromagenda: body must be an object');
  }
  const b = /** @type {Record<string, unknown>} */ (body);
  const url = typeof b.agendaUrl === 'string' ? b.agendaUrl.trim() : '';
  const hasUrl = url.length > 0;
  const hasJson = b.agendaJson !== undefined && b.agendaJson !== null;
  const modes = [hasUrl, hasJson].filter(Boolean).length;
  if (modes > 1) {
    throw new Error('bookfromagenda: use exactly one of agenda.json or agenda.url (with agenda.type)');
  }
  if (modes === 0) {
    throw new Error('bookfromagenda: provide agenda.json or agenda.url plus agenda.type');
  }

  if (hasJson) {
    return normalizeAgendaJson(b.agendaJson, validateUniversalAgenda);
  }
  const at = b.agendaType;
  if (typeof at !== 'string' || !at.trim()) {
    throw new Error('bookfromagenda: agenda.type required with agenda.url');
  }
  return await fetchAndAdaptAgenda(url, at, b, validateUniversalAgenda);
}

module.exports = {
  resolveUniversalAgenda,
  normalizeAgendaJson,
  fetchUrlSafe,
  INTERNAL_ICS_GRID,
};
