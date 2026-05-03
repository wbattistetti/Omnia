/**
 * Griglia mese (lun-dom) e confronti data solo locali per CustomDatePickerPanel.
 */

/** Primo giorno del mese, mezzanotte locale. */
export function startOfMonthDate(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0, 1);
}

export function addCalendarMonths(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + delta);
  return x;
}

export function addCalendarYears(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + delta);
  return x;
}

/** Stesso giorno di calendario (locale). */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Mezzanotte locale «oggi». */
export function localTodayStart(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function localTomorrowStart(): Date {
  const t = localTodayStart();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
}

export type MonthGridRow = (Date | null)[];

/**
 * Righe da 7 celle; null = padding. La settimana inizia il lunedì.
 */
export function buildMonthGrid(year: number, monthIndex0: number): MonthGridRow[] {
  const first = new Date(year, monthIndex0, 1);
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  const mondayIndex = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < mondayIndex; i += 1) {
    cells.push(null);
  }
  for (let d = 1; d <= lastDay; d += 1) {
    cells.push(new Date(year, monthIndex0, d));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const rows: MonthGridRow[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}
