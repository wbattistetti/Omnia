'use strict';

/**
 * Run: node --test backend/services/schedulingConstraintSolver.spec.cjs
 */

const test = require('node:test');
const assert = require('node:assert');
const { solveSchedulingConstraints, _internal } = require('./schedulingConstraintSolver.js');

test('parseClock and forbidden overlap', () => {
  assert.strictEqual(_internal.parseClock('09:00'), 9 * 60);
  assert.strictEqual(_internal.parseClock('24:00'), 24 * 60);
});

test('feasible: one day, full day, no forbidden', () => {
  const r = solveSchedulingConstraints({
    schemaVersion: 1,
    horizon: { start: '2026-05-04', end: '2026-05-04' },
    slotDurationMinutes: 60,
    slotStepMinutes: 60,
    mandatory: { forbiddenIntervals: [] },
  });
  assert.strictEqual(r.summary.unsatMandatory, false);
  assert.strictEqual(r.slotsRanked.length, 24);
  assert.strictEqual(r.slotsRanked[0].date, '2026-05-04');
  assert.strictEqual(r.slotsRanked[0].start, '00:00');
});

test('forbidden lunch removes slots', () => {
  const r = solveSchedulingConstraints({
    schemaVersion: 1,
    horizon: { start: '2026-05-04', end: '2026-05-04' },
    slotDurationMinutes: 60,
    slotStepMinutes: 30,
    mandatory: {
      allowedIntervals: [{ start: '09:00', end: '18:00' }],
      forbiddenIntervals: [{ start: '12:00', end: '13:00' }],
    },
  });
  const starts = r.slotsRanked.map((s) => s.start);
  assert.ok(!starts.includes('12:00'));
  assert.ok(!starts.includes('12:30'));
  assert.ok(starts.includes('11:00'));
});

test('weekdays: only Monday in range', () => {
  const r = solveSchedulingConstraints({
    schemaVersion: 1,
    horizon: { start: '2026-05-04', end: '2026-05-10' },
    slotDurationMinutes: 1440,
    slotStepMinutes: 1440,
    mandatory: {
      weekdays: [1],
    },
  });
  assert.strictEqual(r.slotsRanked.length, 1);
  assert.strictEqual(r.slotsRanked[0].date, '2026-05-04');
});

test('preferred ranking boosts afternoon inside preferred window', () => {
  const r = solveSchedulingConstraints({
    schemaVersion: 1,
    horizon: { start: '2026-05-04', end: '2026-05-04' },
    slotDurationMinutes: 60,
    slotStepMinutes: 60,
    mandatory: {
      allowedIntervals: [{ start: '09:00', end: '18:00' }],
      forbiddenIntervals: [],
    },
    preferred: {
      intervals: [{ start: '14:00', end: '17:00', weight: 10 }],
    },
  });
  assert.strictEqual(r.summary.maxPreferredScore, 10);
  assert.strictEqual(r.slotsRanked[0].start, '14:00');
  assert.strictEqual(r.preferred_relaxed, false);
});

test('cross-midnight same row throws', () => {
  assert.throws(() =>
    solveSchedulingConstraints({
      schemaVersion: 1,
      horizon: { start: '2026-05-04', end: '2026-05-04' },
      slotDurationMinutes: 60,
      mandatory: {
        forbiddenIntervals: [{ start: '22:00', end: '06:00' }],
      },
    })
  );
});
