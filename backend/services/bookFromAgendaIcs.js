/**
 * Minimal ICS (iCalendar) parsing: VEVENT → busy intervals per date → UniversalAgenda via grid.
 * Limits: no RRULE; Date parsing via JavaScript Date (Z = UTC).
 */

'use strict';

function unfoldIcsLines(text) {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = [];
  let buf = '';
  for (const part of raw.split('\n')) {
    if ((part.startsWith(' ') || part.startsWith('\t')) && buf) {
      buf += part.slice(1);
    } else {
      if (buf) lines.push(buf);
      buf = part;
    }
  }
  if (buf) lines.push(buf);
  return lines;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoDateFromLocalDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * @param {string} v after DTSTART:/DTEND:
 */
function parseIcsValue(v) {
  const t = v.trim();
  if (/^\d{8}$/.test(t)) {
    return { allDay: true, date: `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/.exec(t);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? 'Z' : ''}`;
    return { allDay: false, dt: new Date(iso) };
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return { allDay: false, dt: d };
  return {};
}

/**
 * @typedef {{ startMin: number, endMin: number }} BusySlice
 */

/**
 * @param {string} icsText
 * @returns {Map<string, BusySlice[]>}
 */
function collectBusyByDate(icsText) {
  /** @type {Map<string, BusySlice[]>} */
  const map = new Map();
  const lines = unfoldIcsLines(icsText);

  let inEvent = false;
  /** @type {{ allDay?: boolean, date?: string, dt?: Date } | null} */
  let evStart = null;
  /** @type {{ allDay?: boolean, date?: string, dt?: Date } | null} */
  let evEnd = null;

  const pushBusy = (dateStr, lo, hi) => {
    if (hi <= lo) return;
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr).push({ startMin: lo, endMin: hi });
  };

  const flushEvent = () => {
    if (!evStart || !evEnd) return;

    if (evStart.allDay && evEnd.allDay && evStart.date && evEnd.date) {
      let d = evStart.date;
      while (d <= evEnd.date) {
        pushBusy(d, 0, 24 * 60);
        const [yy, mm, dd] = d.split('-').map(Number);
        const nx = new Date(yy, mm - 1, dd + 1);
        d = isoDateFromLocalDate(nx);
      }
      return;
    }

    if (evStart.dt && evEnd.dt) {
      const endMs = evEnd.dt.getTime();
      let t = new Date(evStart.dt.getTime());
      while (t.getTime() < endMs) {
        const dateStr = isoDateFromLocalDate(t);
        const dayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
        const nextMidnight = new Date(dayStart.getTime() + 86400000);
        const chunkEndMs = Math.min(endMs, nextMidnight.getTime());
        const lo = Math.floor((t.getTime() - dayStart.getTime()) / 60000);
        const hi = Math.ceil((chunkEndMs - dayStart.getTime()) / 60000);
        pushBusy(dateStr, Math.max(0, lo), Math.min(24 * 60, hi));
        t = nextMidnight;
      }
    }
  };

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      evStart = null;
      evEnd = null;
    } else if (line === 'END:VEVENT') {
      if (inEvent) flushEvent();
      inEvent = false;
    } else if (inEvent) {
      const up = line.toUpperCase();
      if (up.startsWith('DTSTART')) {
        const idx = line.indexOf(':');
        if (idx >= 0) evStart = parseIcsValue(line.slice(idx + 1));
      } else if (up.startsWith('DTEND')) {
        const idx = line.indexOf(':');
        if (idx >= 0) evEnd = parseIcsValue(line.slice(idx + 1));
      }
    }
  }

  /** @type {Map<string, BusySlice[]>} */
  const mergedMap = new Map();
  for (const [k, slices] of map.entries()) {
    slices.sort((a, b) => a.startMin - b.startMin);
    /** @type {BusySlice[]} */
    const merged = [];
    for (const s of slices) {
      const last = merged[merged.length - 1];
      if (!last || s.startMin >= last.endMin) merged.push({ ...s });
      else last.endMin = Math.max(last.endMin, s.endMin);
    }
    mergedMap.set(k, merged);
  }
  return mergedMap;
}

function nextIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return isoDateFromLocalDate(dt);
}

/**
 * @param {Map<string, { startMin: number, endMin: number }[]>} busyByDate
 * @param {{ horizonStart: string, horizonEnd: string, dayStartMin: number, dayEndMin: number, slotDuration: number, slotStep: number, timezone?: string }} opts
 */
function busyMapToUniversalAgenda(busyByDate, opts) {
  const days = [];
  let cur = opts.horizonStart;
  while (cur <= opts.horizonEnd) {
    const busy = busyByDate.get(cur) || [];
    /** @type {{ time: string, duration: number, status: 'free'|'booked' }[]} */
    const slots = [];
    for (let s = opts.dayStartMin; s + opts.slotDuration <= opts.dayEndMin; s += opts.slotStep) {
      const e = s + opts.slotDuration;
      let booked = false;
      for (const b of busy) {
        if (s < b.endMin && e > b.startMin) {
          booked = true;
          break;
        }
      }
      slots.push({
        time: `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`,
        duration: opts.slotDuration,
        status: booked ? 'booked' : 'free',
      });
    }
    days.push({ date: cur, slots });
    cur = nextIsoDate(cur);
  }

  return {
    timezone: opts.timezone || 'UTC',
    days,
  };
}

module.exports = {
  collectBusyByDate,
  busyMapToUniversalAgenda,
};
