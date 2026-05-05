/**
 * BookFromAgenda: intersect UniversalAgenda (real free/busy) with a SchedulingQuery (user constraints).
 * Input: dotted keys only — agenda.json | agenda.url + agenda.type (see bookFromAgendaInput.js).
 */

'use strict';

const { resolveUniversalAgenda } = require('./bookFromAgendaInput');
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

function normalizeQueryConstraints(body) {
  const qcRaw = isRecord(body.queryConstraints)
    ? body.queryConstraints
    : isRecord(body.query)
      ? body.query
      : null;
  if (!qcRaw) {
    throw new Error('bookfromagenda: queryConstraints object required');
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
  const dottedHorizon =
    body['horizon.start'] !== undefined || body['horizon.end'] !== undefined
      ? {
          start: String(body['horizon.start'] ?? ''),
          end: String(body['horizon.end'] ?? ''),
        }
      : null;
  const horizon = qcHorizon || dottedHorizon;

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
 */
function solveWithAgenda(agenda, qObj) {
  const matchDur =
    qObj.matchSlotDurationMinutes === undefined || qObj.matchSlotDurationMinutes === null
      ? undefined
      : Number(qObj.matchSlotDurationMinutes);

  if (matchDur !== undefined && (!Number.isFinite(matchDur) || matchDur <= 0)) {
    throw new Error('bookfromagenda: query.matchSlotDurationMinutes invalid');
  }

  const qNorm = normalizeSchedulingQueryParts({
    horizon: qObj.horizon,
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
 * @param {unknown} raw
 */
async function solveBookFromAgenda(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('bookfromagenda: body must be a JSON object');
  }
  const body = /** @type {Record<string, unknown>} */ (raw);
  const agendaPayload = resolveAgendaPayload(body);

  const agenda = /** @type {{ days: { date: string, slots: unknown[] }[], timezone?: string }} */ (
    await resolveUniversalAgenda(agendaPayload, validateUniversalAgenda)
  );

  const qObj = normalizeQueryConstraints(body);

  return solveWithAgenda(agenda, qObj);
}

module.exports = {
  solveBookFromAgenda,
  validateUniversalAgenda,
  solveWithAgenda,
};
