import { describe, expect, it } from 'vitest';
import {
  parseItalianSurfaceToIsoDate,
  resolveValueKindToConcrete,
  toIsoDateLocal,
} from '../valueKindResolver';

describe('valueKindResolver', () => {
  it('resolves end_of_month', () => {
    const ref = new Date(2026, 4, 15);
    expect(resolveValueKindToConcrete('end_of_month', { referenceDate: ref })).toBe('2026-05-31');
  });

  it('resolves tomorrow', () => {
    const ref = new Date(2026, 4, 15);
    expect(resolveValueKindToConcrete('tomorrow', { referenceDate: ref })).toBe('2026-05-16');
  });

  it('parses italian specific date', () => {
    const ref = new Date(2026, 0, 1);
    expect(parseItalianSurfaceToIsoDate('15 giugno 2026', ref)).toBe('2026-06-15');
    expect(
      resolveValueKindToConcrete('specific_date', {
        referenceDate: ref,
        surfaceLiteral: '15 giugno',
      })
    ).toBe(`${ref.getFullYear()}-06-15`);
  });

  it('toIsoDateLocal pads month/day', () => {
    expect(toIsoDateLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
