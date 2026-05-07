/**
 * BookFromAgenda: intersect UniversalAgenda (real free/busy) with a SchedulingQuery (user constraints).
 * Input: dotted keys only — agenda.json | agenda.url + agenda.type (see bookFromAgendaInput.js).
 */

'use strict';

const { logSolveDecision, logSolveEntry } = require('./bookFromAgendaSolveDiagnostics');
const { resolveUniversalAgenda } = require('./bookFromAgendaInput');
const {
  buildScopePersistenceKey,
  extractForceRefresh,
  hasAgendaSource,
  fingerprintFromBody,
  loadCachedAgenda,
  saveCachedAgenda,
  DEFAULT_TTL_SEC,
} = require('./bookFromAgendaSlotCache');
const {
  normalizeSchedulingQueryParts,
  slotFitsQueryMandatory,
  preferredScore,
  _internal: { parseClock },
} = require('./schedulingConstraintSolver');

/**
 * @param {number} m minutes from midnight
 */
function formatHm(m) {
  const h = String(Math.floor(m / 60)).padStart(2, '0');
  const min = String(m % 60).padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * @param {unknown} agenda
 */
function validateUniversalAgenda(agenda) {
  if (!agenda || typeof agenda !== 'object' || Array.isArray(agenda)) {
    throw new Error('bookfromagenda: agenda must be an object');
  }
  const o = /** @type {Record<string, unknown>} */ (agenda);
  const days = o.days;
  if (!Array.isArray(days)) throw new Error('bookfromagenda: agenda.days must be an array');
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      throw new Error(`bookfromagenda: agenda.days[${i}] invalid`);
    }
    const dr = /** @type {Record<string, unknown>} */ (d);
    if (typeof dr.date !== 'string') throw new Error(`bookfromagenda: days[${i}].date required`);
    const slots = dr.slots;
    if (!Array.isArray(slots)) throw new Error(`bookfromagenda: days[${i}].slots must be array`);
    for (let j = 0; j < slots.length; j++) {
      const s = slots[j];
      if (!s || typeof s !== 'object') throw new Error(`bookfromagenda: slot [${i}][${j}] invalid`);
      const sr = /** @type {Record<string, unknown>} */ (s);
      if (typeof sr.time !== 'string') throw new Error(`bookfromagenda: slot time required`);
      const dur = Number(sr.duration);
      if (!Number.isFinite(dur) || dur <= 0) throw new Error(`bookfromagenda: slot duration invalid`);
      const st = sr.status;
      if (st !== 'free' && st !== 'booked') {
        throw new Error(`bookfromagenda: slot status must be free|booked`);
      }
      if (sr.resource !== undefined && sr.resource !== null && typeof sr.resource !== 'string') {
        throw new Error(`bookfromagenda: slot resource must be string when present`);
      }
    }
  }
}

/**
 * @param {unknown} x
 * @returns {x is Record<string, unknown>}
 */
function isRecord(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Horizon per fetch URL: chiavi puntate `horizon.start` / `horizon.end`, oppure `queryConstraints.horizon`.
 * @param {Record<string, unknown>} body
 */
function extractHorizon(body) {
  if (body['horizon.start'] !== undefined || body['horizon.end'] !== undefined) {
    return {
      start: String(body['horizon.start'] ?? ''),
      end: String(body['horizon.end'] ?? ''),
    };
  }
  const qc = body.queryConstraints;
  if (isRecord(qc) && isRecord(qc.horizon) && qc.horizon.start !== undefined && qc.horizon.end !== undefined) {
    return { start: String(qc.horizon.start), end: String(qc.horizon.end) };
  }
  return undefined;
}

/**
 * Payload per `resolveUniversalAgenda`: una sola forma pubblica — chiavi puntate `agenda.json` | `agenda.url`+`agenda.type`.
 */
function resolveAgendaPayload(body) {
  const agendaJson = body['agenda.json'];
  const agendaUrl =
    typeof body['agenda.url'] === 'string' ? String(body['agenda.url']).trim() : '';
  const agendaType =
    typeof body['agenda.type'] === 'string' ? String(body['agenda.type']).trim() : '';

  const hasJson = agendaJson !== undefined && agendaJson !== null;
  const hasUrl = agendaUrl.length > 0;

  if (hasJson && hasUrl) {
    throw new Error('bookfromagenda: use exactly one of agenda.json or agenda.url (with agenda.type)');
  }
  if (!hasJson && !hasUrl) {
    throw new Error('bookfromagenda: provide agenda.json (object) or agenda.url plus agenda.type');
  }

  const horizon = extractHorizon(body);

  if (hasJson) {
    return { agendaJson, horizon };
  }
  return { agendaUrl, agendaType, horizon };
}

/**
 * Min/max date da UniversalAgenda.days (YYYY-MM-DD).
 * @param {{ days: { date: string }[] }} agenda
 */
function deriveHorizonFromAgendaDays(agenda) {
  const days = agenda.days;
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error('bookfromagenda: cannot derive horizon — agenda has no days');
  }
  let min = /** @type {string | null} */ (null);
  let max = /** @type {string | null} */ (null);
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const ds = d && typeof d === 'object' && !Array.isArray(d) ? String(/** @type {{ date?: unknown }} */ (d).date ?? '') : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) {
      throw new Error(`bookfromagenda: cannot derive horizon — invalid days[${i}].date`);
    }
    if (!min || ds < min) min = ds;
    if (!max || ds > max) max = ds;
  }
  return { start: /** @type {string} */ (min), end: /** @type {string} */ (max) };
}

/**
 * @param {unknown} h
 */
function horizonExplicitComplete(h) {
  if (!isRecord(h)) return false;
  const a = String(h.start ?? '').trim();
  const b = String(h.end ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b);
}

/**
 * Deriva finestra solver da days quando non si passa horizon (Omnia / agenda.json; dopo materializzazione anche ICS-like).
 * Fetch ICS da URL resta con horizon obbligatorio in {@link extractHorizon}.
 * @param {Record<string, unknown>} body body HTTP originale
 */
function shouldDeriveHorizonWhenMissing(body) {
  if (body['agenda.json'] !== undefined && body['agenda.json'] !== null) return true;
  const t = String(body['agenda.type'] || '').trim().toUpperCase();
  return t === 'OMNIA' || t === 'ICS' || t === 'GOOGLE' || t === 'OUTLOOK';
}

/**
 * Validazione esplicita: il modello non deve inviare stringhe JSON al posto dell’oggetto (errore 400 leggibile).
 * @param {Record<string, unknown>} body
 */
function assertQueryConstraintPayloadShape(body) {
  if (Object.prototype.hasOwnProperty.call(body, 'queryConstraints')) {
    const q = body.queryConstraints;
    if (q != null && (!isRecord(q) || Array.isArray(q))) {
      const err = new Error(
        'bookfromagenda: queryConstraints must be a JSON object (not a string). Example: { "weekdays": [2, 4], "horizon": { "start": "2026-05-01", "end": "2026-05-31" } }. OpenAPI: components/schemas/SchedulingQueryConstraints.'
      );
      err.bfaDiagnostic = {
        failedStage: 'query_constraints_shape',
        fields: {
          queryConstraints: {
            expected: 'object (plain JSON)',
            actual: Array.isArray(q) ? 'array' : typeof q,
            note:
              typeof q === 'string'
                ? 'Il client ha inviato una stringa (spesso JSON serializzato). Usare un oggetto annidato nel body.'
                : undefined,
          },
        },
      };
      throw err;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'query')) {
    const q = body.query;
    if (q != null && (!isRecord(q) || Array.isArray(q))) {
      const err = new Error(
        'bookfromagenda: query (alias of queryConstraints) must be a JSON object, not a string or array.'
      );
      err.bfaDiagnostic = {
        failedStage: 'query_constraints_shape',
        fields: {
          query: {
            expected: 'object',
            actual: Array.isArray(q) ? 'array' : typeof q,
          },
        },
      };
      throw err;
    }
  }
}

function normalizeQueryConstraints(body) {
  const qcRaw = isRecord(body.queryConstraints)
    ? body.queryConstraints
    : isRecord(body.query)
      ? body.query
      : null;

  const dottedHorizonOnly =
    body['horizon.start'] !== undefined || body['horizon.end'] !== undefined
      ? {
          start: String(body['horizon.start'] ?? ''),
          end: String(body['horizon.end'] ?? ''),
        }
      : null;

  /** Assenza di queryConstraints/query = nessun vincolo (solo horizon da chiavi puntate se presenti). */
  if (!qcRaw) {
    return {
      horizon: dottedHorizonOnly,
      mandatory: {},
    };
  }

  const qc = /** @type {Record<string, unknown>} */ (qcRaw);
  const explicitMandatory = isRecord(qc.mandatory) ? qc.mandatory : null;
  const explicitPreferred = isRecord(qc.preferred) ? qc.preferred : null;

  const mandatory =
    explicitMandatory ||
    {
      ...(qc.allowedIntervals !== undefined ? { allowedIntervals: qc.allowedIntervals } : {}),
      ...(qc.forbiddenIntervals !== undefined ? { forbiddenIntervals: qc.forbiddenIntervals } : {}),
      ...(qc.weekdays !== undefined ? { weekdays: qc.weekdays } : {}),
    };

  const preferred =
    explicitPreferred ||
    (qc.preferredIntervals !== undefined ? { intervals: qc.preferredIntervals } : undefined);

  const qcHorizon = isRecord(qc.horizon) ? qc.horizon : null;
  const horizon = qcHorizon || dottedHorizonOnly;

  return {
    horizon,
    mandatory,
    ...(preferred ? { preferred } : {}),
    ...(qc.matchSlotDurationMinutes !== undefined
      ? { matchSlotDurationMinutes: qc.matchSlotDurationMinutes }
      : {}),
  };
}

/**
 * @param {{ days: { date: string, slots: unknown[] }[], timezone?: string }} agenda
 * @param {Record<string, unknown>} qObj normalized query object
 * @param {Record<string, unknown>} body body HTTP originale (per derivazione horizon)
 */
function solveWithAgenda(agenda, qObj, body) {
  const matchDur =
    qObj.matchSlotDurationMinutes === undefined || qObj.matchSlotDurationMinutes === null
      ? undefined
      : Number(qObj.matchSlotDurationMinutes);

  if (matchDur !== undefined && (!Number.isFinite(matchDur) || matchDur <= 0)) {
    throw new Error('bookfromagenda: query.matchSlotDurationMinutes invalid');
  }

  let horizon = qObj.horizon;
  if (!horizonExplicitComplete(horizon)) {
    const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    if (shouldDeriveHorizonWhenMissing(b)) {
      horizon = deriveHorizonFromAgendaDays(agenda);
    }
  } else {
    const hz = /** @type {{ start?: unknown; end?: unknown }} */ (horizon);
    horizon = { start: String(hz.start ?? '').trim(), end: String(hz.end ?? '').trim() };
  }

  if (!horizonExplicitComplete(horizon)) {
    throw new Error(
      'bookfromagenda: set horizon (queryConstraints.horizon or horizon.start/end), or use agenda.json / Omnia URL so horizon can be derived from agenda.days'
    );
  }

  const qNorm = normalizeSchedulingQueryParts({
    horizon,
    mandatory: qObj.mandatory,
    preferred: qObj.preferred,
  });

  /** @type {{ date: string, start: string, end: string, startMinute: number, endMinute: number, duration: number, preferredScore: number, resource?: string }[]} */
  const feasible = [];

  for (const day of agenda.days) {
    const dateStr = day.date;
    for (const slot of day.slots) {
      const sr = /** @type {Record<string, unknown>} */ (slot);
      if (sr.status !== 'free') continue;

      const dur = Number(sr.duration);
      if (matchDur !== undefined && dur !== matchDur) continue;

      const startMin = parseClock(String(sr.time));
      const endMin = startMin + dur;
      if (endMin > 24 * 60) {
        throw new Error(
          `bookfromagenda: slot ${dateStr} ${String(sr.time)}+${dur}m crosses midnight — model as two days in UniversalAgenda`
        );
      }

      if (!slotFitsQueryMandatory(dateStr, startMin, endMin, qNorm)) continue;

      const ps = preferredScore(startMin, endMin, qNorm.prefIntervals);
      const row = {
        date: dateStr,
        start: formatHm(startMin),
        end: formatHm(endMin),
        startMinute: startMin,
        endMinute: endMin,
        duration: dur,
        preferredScore: ps,
      };
      if (typeof sr.resource === 'string' && sr.resource.length > 0) {
        row.resource = sr.resource;
      }
      feasible.push(row);
    }
  }

  feasible.sort((a, b) => {
    if (b.preferredScore !== a.preferredScore) return b.preferredScore - a.preferredScore;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startMinute - b.startMinute;
  });

  const dateSet = new Set(feasible.map((r) => r.date));
  /** @type {{ date: string, start: string, end: string, duration: number, resource?: string }[]} */
  const slots = feasible.map((r) => {
    const row = {
      date: r.date,
      start: r.start,
      end: r.end,
      duration: r.duration,
    };
    if (typeof r.resource === 'string' && r.resource.length > 0) {
      row.resource = r.resource;
    }
    return row;
  });

  return {
    slots,
    summary: {
      dayCount: dateSet.size,
      slotCount: slots.length,
    },
  };
}

/**
 * Snapshot Redis per UniversalAgenda:
 * - `conversationId`, `projectId` (stringhe; vuote se non usate) → chiave scope composita.
 * - Prima richiesta con `agenda.url` o `agenda.json`: materializza, salva, applica filtri.
 * - Richieste successive con stesso scope e stessa impronta sorgente: niente refetch.
 * - `forceRefresh: true`: ignora cache e rifetch.
 * - Solo `queryConstraints` senza sorgente: legge snapshot (richiede scope non vuoto + cache hit).
 *
 * @param {unknown} raw
 */
async function solveBookFromAgenda(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('bookfromagenda: body must be a JSON object');
  }
  const body = /** @type {Record<string, unknown>} */ (raw);

  assertQueryConstraintPayloadShape(body);

  const forceRefresh = extractForceRefresh(body);
  const scopeId = buildScopePersistenceKey(body);

  logSolveEntry(body);

  /** Follow-up: solo filtri, senza agenda.json / agenda.url */
  if (!hasAgendaSource(body)) {
    logSolveDecision('follow_up_redis_snapshot_only', { note: 'forceRefresh non rifetch URL se assente agenda source' });
    if (!scopeId) {
      throw new Error(
        'bookfromagenda: provide agenda.json or agenda.url (first call), or set at least one of conversationId / projectId (non-empty) to use a cached agenda'
      );
    }
    const cached = await loadCachedAgenda(scopeId);
    if (!cached) {
      logSolveDecision('cache_miss_follow_up', { persistenceKey: scopeId });
      throw new Error(
        'bookfromagenda: no cached agenda for this scope — send agenda.url or agenda.json on the first request with the same conversationId / projectId values'
      );
    }
    const agendaCached = /** @type {{ days: { date: string, slots: unknown[] }[], timezone?: string }} */ (
      cached.universalAgenda
    );
    validateUniversalAgenda(agendaCached);
    const qObjFollow = normalizeQueryConstraints(body);
    logSolveDecision('ok_follow_up_from_redis', { daysInAgenda: agendaCached.days?.length });
    return solveWithAgenda(agendaCached, qObjFollow, body);
  }

  let fp;
  try {
    fp = fingerprintFromBody(body);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }

  /** Cache hit: stesso scope, stessa sorgente, niente refresh forzato */
  if (scopeId && !forceRefresh) {
    const entry = await loadCachedAgenda(scopeId);
    if (entry && entry.sourceFingerprint === fp) {
      logSolveDecision('redis_cache_hit_same_fingerprint', { fingerprint: fp.slice(0, 24) });
      const agendaHit = /** @type {{ days: { date: string, slots: unknown[] }[], timezone?: string }} */ (
        entry.universalAgenda
      );
      validateUniversalAgenda(agendaHit);
      const qObjHit = normalizeQueryConstraints(body);
      return solveWithAgenda(agendaHit, qObjHit, body);
    }
    logSolveDecision('redis_cache_miss_or_fingerprint_mismatch', {
      hadEntry: !!entry,
      fingerprintMatch: !!(entry && entry.sourceFingerprint === fp),
    });
  } else if (scopeId && forceRefresh) {
    logSolveDecision('skip_redis_cache_because_force_refresh', {});
  }

  logSolveDecision('materialize_fetch_agenda', { agendaUrlPresent: typeof body['agenda.url'] === 'string' });

  const agendaPayload = resolveAgendaPayload(body);
  const agenda = /** @type {{ days: { date: string, slots: unknown[] }[], timezone?: string }} */ (
    await resolveUniversalAgenda(agendaPayload, validateUniversalAgenda)
  );

  if (scopeId) {
    await saveCachedAgenda(scopeId, fp, agenda, DEFAULT_TTL_SEC);
    logSolveDecision('saved_agenda_to_redis', { persistenceKey: scopeId });
  }

  const qObj = normalizeQueryConstraints(body);
  return solveWithAgenda(agenda, qObj, body);
}

module.exports = {
  solveBookFromAgenda,
  validateUniversalAgenda,
  solveWithAgenda,
  deriveHorizonFromAgendaDays,
  horizonExplicitComplete,
  assertQueryConstraintPayloadShape,
};
