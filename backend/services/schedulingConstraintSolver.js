/**
 * Deterministic scheduling solver v1: mandatory allowed/forbidden/weekdays → feasible slots;
 * preferred intervals → ranking (no feasibility change).
 * Calendar dates are civil YYYY-MM-DD; times are HH:mm in the tenant/agenda zone (caller responsibility).
 */

'use strict';

/** @typedef {{ start: string, end: string }} TimeInterval */
/** @typedef {{ start: string, end: string, weight?: number }} PreferredInterval */

/**
 * @typedef {object} SchedulingSolveInputV1
 * @property {1} schemaVersion
 * @property {string} [timezone] IANA id — informational for logs/UI; slot math uses dates/times as given.
 * @property {{ start: string, end: string }} horizon Inclusive ISO dates YYYY-MM-DD.
 * @property {number} [slotDurationMinutes] default 30
 * @property {number} [slotStepMinutes] grid step default 15
 * @property {object} mandatory
 * @property {TimeInterval[]} [mandatory.allowedIntervals] Omit = full clock day [00:00, 24:00).
 * @property {TimeInterval[]} [mandatory.forbiddenIntervals]
 * @property {number[]} [mandatory.weekdays] 0=Sun … 6=Sat (Date.getUTCDay()).
 * @property {object} [preferred]
 * @property {PreferredInterval[]} [preferred.intervals]
 */

const DEFAULT_SCHEMA = 1;

/**
 * @param {unknown} s
 * @returns {string}
 */
function assertIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`scheduling: horizon date must be YYYY-MM-DD, got ${JSON.stringify(s)}`);
  }
  const d = parseIsoDateUtc(s);
  if (Number.isNaN(d.getTime())) throw new Error(`scheduling: invalid date "${s}"`);
  return s;
}

/**
 * @param {string} iso YYYY-MM-DD
 */
function parseIsoDateUtc(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

/**
 * @param {Date} d UTC noon anchor
 */
function formatIsoDateUtc(d) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * @param {string} start
 * @param {string} end
 * @yields {string}
 */
function* eachIsoDateInclusive(start, end) {
  let cur = parseIsoDateUtc(assertIsoDate(start));
  const last = parseIsoDateUtc(assertIsoDate(end));
  if (cur > last) return;
  while (true) {
    yield formatIsoDateUtc(cur);
    if (formatIsoDateUtc(cur) === formatIsoDateUtc(last)) return;
    cur = new Date(cur.getTime());
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

/**
 * @param {string} t "HH:mm"
 * @returns {number} minutes from midnight [0, 24*60]
 */
function parseClock(t) {
  if (typeof t !== 'string') throw new Error(`scheduling: time must be string, got ${typeof t}`);
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) throw new Error(`scheduling: invalid time "${t}" (expected HH:mm)`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 24 || mm < 0 || mm > 59) throw new Error(`scheduling: time out of range "${t}"`);
  if (hh === 24 && mm !== 0) throw new Error(`scheduling: only 24:00 allowed as end sentinel`);
  const minutes = hh * 60 + mm;
  if (minutes > 24 * 60) throw new Error(`scheduling: time overflow "${t}"`);
  return minutes;
}

/**
 * @param {TimeInterval} iv
 * @returns {{ lo: number, hi: number }} half-open [lo, hi) in minutes from midnight
 */
function intervalToHalfOpen(iv) {
  const lo = parseClock(iv.start);
  let hi = parseClock(iv.end);
  if (hi <= lo && iv.end.trim() !== '24:00') {
    throw new Error(
      `scheduling: interval end must be after start on same calendar row (split cross-midnight into two days): ${iv.start}–${iv.end}`
    );
  }
  if (iv.end.trim() === '24:00' || hi === 24 * 60) hi = 24 * 60;
  return { lo, hi };
}

/**
 * @param {number} a0
 * @param {number} a1
 * @param {number} b0
 * @param {number} b1
 */
function rangesOverlapHalfOpen(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

/**
 * Slot [s,e) half-open overlaps forbidden [f0,f1) if any intersection.
 * @param {number} s
 * @param {number} e
 * @param {{ lo: number, hi: number }} f
 */
function slotOverlapsForbidden(s, e, f) {
  return rangesOverlapHalfOpen(s, e, f.lo, f.hi);
}

/**
 * Slot fully inside union of allowed intervals (half-open).
 * @param {number} s
 * @param {number} e
 * @param {{ lo: number, hi: number }[]} allowedParts
 */
function slotInsideAllowedUnion(s, e, allowedParts) {
  return allowedParts.some((p) => s >= p.lo && e <= p.hi);
}

/**
 * @param {TimeInterval[]|undefined} raw
 * @returns {{ lo: number, hi: number }[]}
 */
function normalizeIntervals(raw, label) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`scheduling: ${label} must be an array`);
  return raw.map((iv, i) => {
    if (!iv || typeof iv !== 'object') throw new Error(`scheduling: ${label}[${i}] invalid`);
    return intervalToHalfOpen({
      start: String(iv.start ?? ''),
      end: String(iv.end ?? ''),
    });
  });
}

/**
 * Preferred score: sum of weights of preferred intervals that fully contain the slot.
 * @param {number} s
 * @param {number} e
 * @param {PreferredInterval[]} prefs
 */
function preferredScore(s, e, prefs) {
  if (!prefs.length) return 0;
  let score = 0;
  for (const p of prefs) {
    const { lo, hi } = intervalToHalfOpen({
      start: String(p.start ?? ''),
      end: String(p.end ?? ''),
    });
    if (s >= lo && e <= hi) score += typeof p.weight === 'number' && !Number.isNaN(p.weight) ? p.weight : 1;
  }
  return score;
}

/**
 * Parsed horizon + mandatory/preferred for reuse (BookFromAgenda intersects real free slots).
 * @typedef {object} SchedulingQueryNormalized
 * @property {string} horizonStart
 * @property {string} horizonEnd
 * @property {{ lo: number, hi: number }[]} allowedParts
 * @property {{ lo: number, hi: number }[]} forbiddenParts
 * @property {number[]} weekdaysSet empty = no weekday filter
 * @property {PreferredInterval[]} prefIntervals
 */

/**
 * Normalizes the constraint portion of a scheduling request (same shapes as solve body).
 * @param {{ horizon: object, mandatory: object, preferred?: object }} bodySlice
 * @returns {SchedulingQueryNormalized}
 */
function normalizeSchedulingQueryParts(bodySlice) {
  const hz = bodySlice.horizon;
  if (!hz || typeof hz !== 'object') throw new Error('scheduling: missing horizon');
  const horizonStart = assertIsoDate(/** @type {{start?:unknown}} */ (hz).start);
  const horizonEnd = assertIsoDate(/** @type {{end?:unknown}} */ (hz).end);

  const mandatory = bodySlice.mandatory;
  if (!mandatory || typeof mandatory !== 'object' || Array.isArray(mandatory)) {
    throw new Error('scheduling: missing mandatory object');
  }

  let allowedParts = normalizeIntervals(
    /** @type {unknown} */ (/** @type {{allowedIntervals?:unknown}} */ (mandatory).allowedIntervals),
    'mandatory.allowedIntervals'
  );
  if (allowedParts.length === 0) {
    allowedParts = [{ lo: 0, hi: 24 * 60 }];
  }

  const forbiddenParts = normalizeIntervals(
    /** @type {unknown} */ (/** @type {{forbiddenIntervals?:unknown}} */ (mandatory).forbiddenIntervals),
    'mandatory.forbiddenIntervals'
  );

  let weekdays = /** @type {unknown} */ (/** @type {{weekdays?:unknown}} */ (mandatory).weekdays);
  if (weekdays === undefined || weekdays === null) weekdays = [];
  else if (!Array.isArray(weekdays)) throw new Error('scheduling: mandatory.weekdays must be an array');
  else {
    weekdays = weekdays.map((d, i) => {
      const n = Number(d);
      if (!Number.isInteger(n) || n < 0 || n > 6) {
        throw new Error(`scheduling: weekdays[${i}] must be integer 0–6`);
      }
      return n;
    });
  }
  /** @type {number[]} */
  const weekdaysSet = /** @type {number[]} */ (weekdays);

  const preferredRaw = bodySlice.preferred;
  let prefIntervals = [];
  if (preferredRaw !== undefined && preferredRaw !== null) {
    if (typeof preferredRaw !== 'object' || Array.isArray(preferredRaw)) {
      throw new Error('scheduling: preferred must be an object');
    }
    const ints = /** @type {{intervals?:unknown}} */ (preferredRaw).intervals;
    if (ints !== undefined && ints !== null) {
      if (!Array.isArray(ints)) throw new Error('scheduling: preferred.intervals must be an array');
      prefIntervals = /** @type {PreferredInterval[]} */ (ints);
    }
  }

  return {
    horizonStart,
    horizonEnd,
    allowedParts,
    forbiddenParts,
    weekdaysSet,
    prefIntervals,
  };
}

/**
 * A single free slot from an agenda row fits the mandatory query (date + time window).
 * @param {string} isoDate YYYY-MM-DD
 * @param {number} startMin
 * @param {number} endMin
 * @param {SchedulingQueryNormalized} q
 */
function slotFitsQueryMandatory(isoDate, startMin, endMin, q) {
  if (isoDate < q.horizonStart || isoDate > q.horizonEnd) return false;
  const dt = parseIsoDateUtc(isoDate);
  const wd = dt.getUTCDay();
  if (q.weekdaysSet.length > 0 && !q.weekdaysSet.includes(wd)) return false;
  if (!slotInsideAllowedUnion(startMin, endMin, q.allowedParts)) return false;
  for (const f of q.forbiddenParts) {
    if (slotOverlapsForbidden(startMin, endMin, f)) return false;
  }
  return true;
}

/**
 * Full deterministic solve.
 * @param {unknown} raw
 */
function solveSchedulingConstraints(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('scheduling: body must be a JSON object');
  }
  const body = /** @type {Record<string, unknown>} */ (raw);
  const sv = body.schemaVersion;
  if (sv !== DEFAULT_SCHEMA) {
    throw new Error(`scheduling: unsupported schemaVersion ${String(sv)} (expected ${DEFAULT_SCHEMA})`);
  }

  const slotDuration = Number(body.slotDurationMinutes ?? 30);
  const slotStep = Number(body.slotStepMinutes ?? 15);
  if (!Number.isFinite(slotDuration) || slotDuration <= 0) {
    throw new Error('scheduling: slotDurationMinutes must be a positive number');
  }
  if (!Number.isFinite(slotStep) || slotStep <= 0) {
    throw new Error('scheduling: slotStepMinutes must be a positive number');
  }

  const q = normalizeSchedulingQueryParts({
    horizon: body.horizon,
    mandatory: body.mandatory,
    preferred: body.preferred,
  });
  const start = q.horizonStart;
  const end = q.horizonEnd;
  const allowedParts = q.allowedParts;
  const forbiddenParts = q.forbiddenParts;
  const weekdaysSet = q.weekdaysSet.length > 0 ? q.weekdaysSet : undefined;
  const prefIntervals = q.prefIntervals;

  /** @type {{ date: string, start: string, end: string, startMinute: number, endMinute: number, preferredScore: number }[]} */
  const feasible = [];

  for (const dateStr of eachIsoDateInclusive(start, end)) {
    const dt = parseIsoDateUtc(dateStr);
    const wd = dt.getUTCDay();
    if (weekdaysSet && weekdaysSet.length > 0 && !weekdaysSet.includes(wd)) continue;

    for (let s = 0; s + slotDuration <= 24 * 60; s += slotStep) {
      const e = s + slotDuration;
      if (!slotInsideAllowedUnion(s, e, allowedParts)) continue;
      let hitForbidden = false;
      for (const f of forbiddenParts) {
        if (slotOverlapsForbidden(s, e, f)) {
          hitForbidden = true;
          break;
        }
      }
      if (hitForbidden) continue;

      const startH = String(Math.floor(s / 60)).padStart(2, '0');
      const startM = String(s % 60).padStart(2, '0');
      const endH = String(Math.floor(e / 60)).padStart(2, '0');
      const endM = String(e % 60).padStart(2, '0');
      const ps = preferredScore(s, e, prefIntervals);
      feasible.push({
        date: dateStr,
        start: `${startH}:${startM}`,
        end: `${endH}:${endM}`,
        startMinute: s,
        endMinute: e,
        preferredScore: ps,
      });
    }
  }

  const maxPreferred = feasible.reduce((m, x) => Math.max(m, x.preferredScore), 0);

  feasible.sort((a, b) => {
    if (b.preferredScore !== a.preferredScore) return b.preferredScore - a.preferredScore;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startMinute - b.startMinute;
  });

  const unsatMandatory = feasible.length === 0;

  /** Slots that achieve best possible preferred score among feasible (may be 0). */
  const bestPreferredSlots = feasible.filter((x) => x.preferredScore === maxPreferred);

  return {
    schemaVersion: DEFAULT_SCHEMA,
    timezone: typeof body.timezone === 'string' ? body.timezone : null,
    summary: {
      unsatMandatory,
      totalFeasible: feasible.length,
      maxPreferredScore: maxPreferred,
      hasPreferredIntervals: prefIntervals.length > 0,
    },
    /** All mandatory-feasible slots, best preferred scores first. */
    slotsRanked: feasible,
    /** Top tier only (ties at max preferred score). Empty when unsatMandatory. */
    bestPreferredSlots,
    /** True when there is at least one feasible slot but none match any preferred interval. */
    preferred_relaxed:
      !unsatMandatory && prefIntervals.length > 0 && maxPreferred === 0,
  };
}

module.exports = {
  solveSchedulingConstraints,
  normalizeSchedulingQueryParts,
  slotFitsQueryMandatory,
  preferredScore,
  _internal: {
    parseClock,
    eachIsoDateInclusive,
    parseIsoDateUtc,
  },
};
