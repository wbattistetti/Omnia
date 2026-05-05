'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { collectBusyByDate, busyMapToUniversalAgenda } = require('./bookFromAgendaIcs.js');

test('ICS single event produces booked slot on grid', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART:20260504T090000Z',
    'DTEND:20260504T093000Z',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  const busy = collectBusyByDate(ics);
  const agenda = busyMapToUniversalAgenda(busy, {
    horizonStart: '2026-05-04',
    horizonEnd: '2026-05-04',
    dayStartMin: 9 * 60,
    dayEndMin: 12 * 60,
    slotDuration: 30,
    slotStep: 30,
    timezone: 'UTC',
  });

  assert.strictEqual(agenda.days.length, 1);
  const booked = agenda.days[0].slots.filter((s) => s.status === 'booked');
  assert.ok(booked.length >= 1);
});
