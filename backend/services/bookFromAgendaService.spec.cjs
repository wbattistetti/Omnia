'use strict';

/**
 * Run: node --test backend/services/bookFromAgendaService.spec.cjs
 */

const test = require('node:test');
const assert = require('node:assert');
const { solveBookFromAgenda } = require('./bookFromAgendaService.js');

test('intersects free slots with query weekdays', async () => {
  const out = await solveBookFromAgenda({
    'agenda.json': {
      days: [
        {
          date: '2026-05-04',
          slots: [
            { time: '09:00', duration: 60, status: 'free' },
            { time: '10:00', duration: 60, status: 'booked' },
          ],
        },
      ],
    },
    queryConstraints: {
      horizon: { start: '2026-05-01', end: '2026-05-31' },
      weekdays: [1],
    },
  });
  assert.strictEqual(out.summary.slotCount, 1);
  assert.strictEqual(out.summary.dayCount, 1);
  assert.strictEqual(out.slots[0].start, '09:00');
  assert.strictEqual(out.slots[0].end, '10:00');
});

test('booked slot excluded', async () => {
  const out = await solveBookFromAgenda({
    'agenda.json': {
      days: [{ date: '2026-05-04', slots: [{ time: '09:00', duration: 60, status: 'booked' }] }],
    },
    queryConstraints: {
      horizon: { start: '2026-05-04', end: '2026-05-04' },
    },
  });
  assert.strictEqual(out.summary.slotCount, 0);
  assert.strictEqual(out.summary.dayCount, 0);
});

test('agenda.json compact single-day', async () => {
  const out = await solveBookFromAgenda({
    'agenda.json': {
      date: '2026-05-04',
      slots: [{ time: '11:00', duration: 30, status: 'free' }],
    },
    queryConstraints: {
      horizon: { start: '2026-05-04', end: '2026-05-04' },
    },
  });
  assert.strictEqual(out.summary.slotCount, 1);
  assert.strictEqual(out.slots[0].start, '11:00');
  assert.strictEqual(out.slots[0].end, '11:30');
});

test('supports dotted agenda fields and horizon', async () => {
  const out = await solveBookFromAgenda({
    'agenda.type': 'Omnia',
    'agenda.json': {
      date: '2026-05-04',
      slots: [{ time: '09:00', duration: 30, status: 'free' }],
    },
    'horizon.start': '2026-05-04',
    'horizon.end': '2026-05-04',
    queryConstraints: {
      horizon: { start: '2026-05-04', end: '2026-05-04' },
    },
  });
  assert.strictEqual(out.summary.slotCount, 1);
});

test('agenda.json dotted only (no agendaJson alias)', async () => {
  const out = await solveBookFromAgenda({
    'agenda.json': {
      date: '2026-05-04',
      slots: [{ time: '14:00', duration: 45, status: 'free' }],
    },
    queryConstraints: {
      horizon: { start: '2026-05-04', end: '2026-05-04' },
    },
  });
  assert.strictEqual(out.summary.slotCount, 1);
  assert.strictEqual(out.slots[0].start, '14:00');
});
