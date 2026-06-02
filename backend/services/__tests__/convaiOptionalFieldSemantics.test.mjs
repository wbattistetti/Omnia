import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  stripEmptyConvaiOptionalFields,
  stripEmptyConvaiOptionalFieldsInPlace,
} from '../convaiOptionalFieldSemantics.js';

describe('convaiOptionalFieldSemantics (gateway)', () => {
  it('stripEmptyConvaiOptionalFieldsInPlace matches next-window ElevenLabs payload', () => {
    const body = {
      windowDays: 10,
      constraints: {
        horizon: { start: '', end: '' },
        forbiddenWeekdays: [],
        allowedWeekdays: [],
        forbiddenMonths: [],
        allowedMonths: [],
        forbiddenDaysOfMonth: [],
        forbiddenDateRanges: [],
        allowedTimeIntervals: [],
        forbiddenTimeIntervals: [],
        preferredTimeIntervals: [],
        slotDurationMinutes: null,
        minSlotDurationMinutes: null,
        maxSlotDurationMinutes: null,
      },
    };
    stripEmptyConvaiOptionalFieldsInPlace(body);
    assert.deepEqual(body, { windowDays: 10 });
  });

  it('stripEmptyConvaiOptionalFields preserves meaningful nested values', () => {
    const out = stripEmptyConvaiOptionalFields({
      windowDays: 10,
      constraints: {
        horizon: { start: '2026-07-13', end: '2026-07-24' },
      },
    });
    assert.deepEqual(out, {
      windowDays: 10,
      constraints: { horizon: { start: '2026-07-13', end: '2026-07-24' } },
    });
  });
});
