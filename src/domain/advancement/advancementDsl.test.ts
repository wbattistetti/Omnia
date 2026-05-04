import { describe, expect, it } from 'vitest';
import {
  ADVANCEMENT_TYPE_MISMATCH_MESSAGE,
  applyAdvancementRulesOrdered,
  validateTypedResult,
} from './advancementDsl';

describe('advancementDsl (tipi + apply)', () => {
  it('validates Date from timestamp ms (JS)', () => {
    const r = validateTypedResult(new Date('2026-01-15').getTime(), 'Date');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('2026-01-15');
  });

  it('validates Date result string', () => {
    const r = validateTypedResult('2026-01-15', 'Date');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('2026-01-15');
  });

  it('rejects type mismatch with unified message', () => {
    const r = validateTypedResult(123, 'String');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(ADVANCEMENT_TYPE_MISMATCH_MESSAGE);
  });

  it('applyAdvancementRulesOrdered evaluates JS and merges constants', () => {
    const js =
      '(() => { const d = new Date("2026-05-01"); d.setUTCDate(d.getUTCDate() + param.daysRange); return d.toISOString().slice(0, 10); })()';
    const { values, errors } = applyAdvancementRulesOrdered({
      inputOrder: ['daysRange', 'startDate'],
      advancementEnabled: { daysRange: false, startDate: true },
      dslByParam: { startDate: js },
      types: { startDate: 'Date', daysRange: 'Int' },
      prev: {},
      paramConstants: { daysRange: 7, startDate: '2026-05-01' },
    });
    expect(errors.length).toBe(0);
    expect(values.daysRange).toBe(7);
    expect(values.startDate).toBe('2026-05-08');
  });
});
