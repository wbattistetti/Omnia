/**
 * Calendario custom: header mese/anno con frecce, griglia lun–dom, evidenziazione oggi e selezione.
 */

import React, { useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DatePickerStrings } from './datePickerLocale';
import {
  addCalendarMonths,
  addCalendarYears,
  buildMonthGrid,
  isSameLocalDay,
} from './customDatePickerModel';

export type CustomDatePickerPanelProps = {
  viewMonth: Date;
  onViewMonthChange: (next: Date) => void;
  /** Giorno cliccato in questa sessione (bozza, rettangolo di selezione). */
  pendingSelection: Date | undefined;
  /** Giorno già salvato nel valore ISO (evidenza piena se non c’è bozza). */
  valueSelection: Date | undefined;
  onSelectDay: (day: Date) => void;
  /** Rotella sulla colonna del nome mese → solo cambio mese. */
  onWheelMonthColumn: (e: React.WheelEvent<HTMLDivElement>) => void;
  /** Rotella sulla colonna anno → solo cambio anno. */
  onWheelYearColumn: (e: React.WheelEvent<HTMLDivElement>) => void;
  /** Rotella sulla griglia giorni → mese (Maiusc + anno). */
  onWheelGrid: (e: React.WheelEvent<HTMLDivElement>) => void;
  strings: DatePickerStrings;
};

export function CustomDatePickerPanel({
  viewMonth,
  onViewMonthChange,
  pendingSelection,
  valueSelection,
  onSelectDay,
  onWheelMonthColumn,
  onWheelYearColumn,
  onWheelGrid,
  strings,
}: CustomDatePickerPanelProps) {
  const y = viewMonth.getFullYear();
  const m0 = viewMonth.getMonth();
  const rows = useMemo(() => buildMonthGrid(y, m0), [y, m0]);

  const monthLabel =
    strings.months[m0] ?? new Intl.DateTimeFormat(undefined, { month: 'long' }).format(viewMonth);

  const weekdays =
    strings.weekdaysShort.length >= 7
      ? strings.weekdaysShort
      : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const navBtn =
    'inline-flex cursor-grab items-center justify-center rounded border border-slate-600/80 bg-slate-800/90 p-0.5 text-sky-400 hover:bg-slate-700 active:cursor-grabbing';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-4 px-1 pt-0.5">
        <div
          className="flex flex-col items-center gap-0.5 rounded px-1 py-0.5"
          onWheel={onWheelMonthColumn}
          title={strings.wheelMonthColumn}
        >
          <button
            type="button"
            className={navBtn}
            title={strings.monthUp}
            aria-label={strings.monthUp}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onViewMonthChange(addCalendarMonths(viewMonth, -1))}
          >
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
          <span className="min-w-[5rem] text-center text-[11px] font-semibold capitalize leading-tight text-amber-200/95">
            {monthLabel}
          </span>
          <button
            type="button"
            className={navBtn}
            title={strings.monthDown}
            aria-label={strings.monthDown}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onViewMonthChange(addCalendarMonths(viewMonth, 1))}
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <div
          className="flex flex-col items-center gap-0.5 rounded px-1 py-0.5"
          onWheel={onWheelYearColumn}
          title={strings.wheelYearColumn}
        >
          <button
            type="button"
            className={navBtn}
            title={strings.yearUp}
            aria-label={strings.yearUp}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onViewMonthChange(addCalendarYears(viewMonth, -1))}
          >
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
          <span className="min-w-[3rem] text-center text-[11px] font-semibold tabular-nums text-amber-200/95">
            {y}
          </span>
          <button
            type="button"
            className={navBtn}
            title={strings.yearDown}
            aria-label={strings.yearDown}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onViewMonthChange(addCalendarYears(viewMonth, 1))}
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>

      <div
        className="rounded-md border border-slate-700/80 bg-slate-950/40 p-1.5"
        onWheel={onWheelGrid}
        title={strings.wheelHint}
      >
        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {weekdays.slice(0, 7).map((wd) => (
            <div
              key={wd}
              className="pb-1 text-[9px] font-medium uppercase tracking-wide text-amber-200/55"
            >
              {wd}
            </div>
          ))}
          {rows.map((row, ri) => (
            <React.Fragment key={ri}>
              {row.map((cell, ci) => {
                if (!cell) {
                  return <div key={`e-${ri}-${ci}`} className="h-7" />;
                }
                const isPending =
                  pendingSelection != null && isSameLocalDay(cell, pendingSelection);
                const isFromValue =
                  !isPending &&
                  valueSelection != null &&
                  isSameLocalDay(cell, valueSelection);
                const isToday =
                  !isPending &&
                  !isFromValue &&
                  isSameLocalDay(cell, new Date());
                return (
                  <button
                    key={cell.getTime()}
                    type="button"
                    className={[
                      'box-border flex h-7 w-full cursor-pointer items-center justify-center rounded text-[11px] font-medium tabular-nums transition-colors',
                      isPending
                        ? 'ring-2 ring-inset ring-amber-300 bg-amber-500/20 text-amber-50 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.45)]'
                        : isFromValue
                          ? 'bg-amber-600 text-white shadow-inner ring-1 ring-amber-400/50'
                          : isToday
                            ? 'ring-2 ring-amber-400/85 bg-slate-800/70 text-amber-100'
                            : 'text-slate-200 hover:bg-slate-700/90',
                    ].join(' ')}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelectDay(cell)}
                  >
                    {cell.getDate()}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
