import { describe, expect, it } from 'vitest';
import { buildMonthGrid, isSameLocalDay, localTodayStart } from '../customDatePickerModel';

describe('buildMonthGrid', () => {
  it('May 2026 has 31 days from the 1st (lun-first grid may add leading nulls)', () => {
    const rows = buildMonthGrid(2026, 4);
    const flat = rows.flat().filter(Boolean) as Date[];
    expect(flat.length).toBe(31);
    expect(flat[0].getFullYear()).toBe(2026);
    expect(flat[0].getMonth()).toBe(4);
    expect(flat[0].getDate()).toBe(1);
  });

  it('includes null padding cells', () => {
    const rows = buildMonthGrid(2026, 4);
    const all = rows.flat();
    expect(all.some((c) => c === null)).toBe(true);
  });
});

describe('isSameLocalDay', () => {
  it('matches calendar day only', () => {
    const a = new Date(2026, 4, 3, 10, 0);
    const b = new Date(2026, 4, 3, 22, 0);
    expect(isSameLocalDay(a, b)).toBe(true);
  });
});

describe('localTodayStart', () => {
  it('returns midnight local', () => {
    const t = localTodayStart();
    expect(t.getHours()).toBe(0);
    expect(t.getMinutes()).toBe(0);
  });
});
