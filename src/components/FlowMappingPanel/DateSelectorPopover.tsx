/**
 * Selettore data compatto: input gg/mm/aaaa + popover con calendario custom e scorciatoie.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Calendar } from 'lucide-react';

import {
  commitTextInputToValue,
  parseIsoDateLocal,
  toIsoDateLocal,
  valueToInputDisplay,
} from './dateSelectorPopoverUtils';
import { CustomDatePickerPanel } from './CustomDatePickerPanel';
import { getDatePickerStrings } from './datePickerLocale';
import { localTodayStart, localTomorrowStart } from './customDatePickerModel';

export type DateSelectorShortcut = {
  label: string;
  /** Costante inviata a `onChange` (es. `NextWeek`). */
  symbolic: string;
};

export type DateSelectorPopoverProps = {
  value: string;
  onChange: (next: string) => void;
  /**
   * Dopo una conferma esplicita (Applica, Oggi, Domani — stesso valore di `onChange`):
   * utile per persistere sul task senza attendere Invio.
   */
  onCommitted?: (next: string) => void;
  /** Scorciatoie simboliche aggiuntive: aggiornano il valore ma non chiudono il popover. */
  extraShortcuts?: readonly DateSelectorShortcut[];
  disabled?: boolean;
  className?: string;
  /** Classi sull’input testuale. */
  inputClassName?: string;
  /** Popover calendario aperto/chiuso — es. per nascondere la lista variabile sotto. */
  onCalendarOpenChange?: (isOpen: boolean) => void;
  /** Solo dopo Applica / Oggi / Domani (ISO), non per shortcut simboliche. */
  onDateCommitComplete?: () => void;
};

export function DateSelectorPopover({
  value,
  onChange,
  onCommitted,
  extraShortcuts = [],
  disabled = false,
  className = '',
  inputClassName = '',
  onCalendarOpenChange,
  onDateCommitComplete,
}: DateSelectorPopoverProps) {
  const str = getDatePickerStrings();

  const [open, setOpen] = useState(false);
  /** Testo libero mentre l’utente modifica l’input (null = deriva da `value`). */
  const [textEdit, setTextEdit] = useState<string | null>(null);
  /** Giorno scelto nel calendario prima di «Applica» (non chiude il popover). */
  const [pendingCalendarDate, setPendingCalendarDate] = useState<Date | undefined>(undefined);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const displayText = textEdit !== null ? textEdit : valueToInputDisplay(value);

  useEffect(() => {
    setTextEdit(null);
  }, [value]);

  const selectedDate = useMemo(() => {
    const v = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
    return parseIsoDateLocal(v);
  }, [value]);

  /** Evidenza calendario: bozza finché non premi Applica; altrimenti valore controllato ISO. */
  const calendarSelected = pendingCalendarDate ?? selectedDate;

  const canApplySelection = calendarSelected != null;

  useEffect(() => {
    if (!open) return;
    setPendingCalendarDate(undefined);
    setCalendarMonth(selectedDate ?? new Date());
  }, [open, selectedDate]);

  useEffect(() => {
    onCalendarOpenChange?.(open);
  }, [open, onCalendarOpenChange]);

  const placePanel = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const margin = 8;
    let left = Math.min(r.left, vw - panel.offsetWidth - margin);
    left = Math.max(margin, left);
    let top = r.bottom + gap;
    const ph = panel.getBoundingClientRect().height || 320;
    if (top + ph > vh - margin && r.top - gap - ph >= margin) {
      top = r.top - gap - ph;
    } else if (top + ph > vh - margin) {
      top = Math.max(margin, vh - margin - ph);
    }
    setPanelStyle({
      position: 'fixed',
      left,
      top,
      zIndex: 100000,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle({});
      return;
    }
    placePanel();
    const raf = window.requestAnimationFrame(() => placePanel());
    window.addEventListener('scroll', placePanel, true);
    window.addEventListener('resize', placePanel);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', placePanel, true);
      window.removeEventListener('resize', placePanel);
    };
  }, [open, placePanel]);

  const emitSymbolic = useCallback(
    (symbolic: string) => {
      const next = symbolic.trim();
      flushSync(() => {
        onChange(next);
      });
      onCommitted?.(next);
      setTextEdit(null);
    },
    [onChange, onCommitted]
  );

  /** Chiude il popover: usato solo da Applica, Oggi e Domani. */
  const commitIsoDateAndClose = useCallback(
    (d: Date) => {
      const iso = toIsoDateLocal(d);
      flushSync(() => {
        onChange(iso);
      });
      onCommitted?.(iso);
      setTextEdit(null);
      setPendingCalendarDate(undefined);
      setOpen(false);
      onDateCommitComplete?.();
    },
    [onChange, onCommitted, onDateCommitComplete]
  );

  const applyCalendarSelection = useCallback(() => {
    const d = pendingCalendarDate ?? selectedDate;
    if (!d) return;
    commitIsoDateAndClose(d);
  }, [pendingCalendarDate, selectedDate, commitIsoDateAndClose]);

  const pickTodayDate = useCallback(() => {
    commitIsoDateAndClose(localTodayStart());
  }, [commitIsoDateAndClose]);

  const pickTomorrowDate = useCallback(() => {
    commitIsoDateAndClose(localTomorrowStart());
  }, [commitIsoDateAndClose]);

  /** Chiude senza inviare modifiche: scarta la bozza calendario e il testo in modifica. */
  const cancelCalendarEditing = useCallback(() => {
    setPendingCalendarDate(undefined);
    setTextEdit(null);
    setOpen(false);
  }, []);

  const toggleOpen = useCallback(() => {
    if (disabled) return;
    setOpen((o) => !o);
  }, [disabled]);

  const commitInput = useCallback(() => {
    const raw = textEdit !== null ? textEdit : valueToInputDisplay(value);
    const next = commitTextInputToValue(raw);
    if (next === null && raw.trim() !== '') {
      setTextEdit(null);
      return;
    }
    if (next !== null && next !== value.trim()) {
      flushSync(() => {
        onChange(next);
      });
    }
    setTextEdit(null);
  }, [textEdit, value, onChange]);

  const shiftCalendarByWheel = useCallback((deltaMonths: number, deltaYears: number) => {
    setCalendarMonth((prev) => {
      const d = new Date(prev);
      if (deltaYears !== 0) {
        d.setFullYear(d.getFullYear() + deltaYears);
      }
      if (deltaMonths !== 0) {
        d.setMonth(d.getMonth() + deltaMonths);
      }
      return d;
    });
  }, []);

  /** Griglia giorni: rotella = mese; Maiusc + rotella = anno. */
  const onCalendarWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const dy = e.deltaY;
      if (dy === 0) return;
      const dir = dy > 0 ? 1 : -1;
      if (e.shiftKey) {
        shiftCalendarByWheel(0, dir);
      } else {
        shiftCalendarByWheel(dir, 0);
      }
    },
    [shiftCalendarByWheel]
  );

  /** Solo sulla colonna nome mese: rotella cambia il mese (mai l’anno). */
  const onWheelMonthColumn = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const dy = e.deltaY;
      if (dy === 0) return;
      const dir = dy > 0 ? 1 : -1;
      shiftCalendarByWheel(dir, 0);
    },
    [shiftCalendarByWheel]
  );

  /** Solo sulla colonna anno: rotella cambia l’anno (mai il mese). */
  const onWheelYearColumn = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const dy = e.deltaY;
      if (dy === 0) return;
      const dir = dy > 0 ? 1 : -1;
      shiftCalendarByWheel(0, dir);
    },
    [shiftCalendarByWheel]
  );

  const panel =
    open && !disabled ? (
      <div
        ref={panelRef}
        data-omnia-date-picker-overlay=""
        className="rounded-lg border border-slate-600 bg-slate-900 p-2 shadow-2xl ring-1 ring-slate-700/80 min-w-[min(100vw-16px,280px)] max-w-[calc(100vw-16px)]"
        style={panelStyle}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <CustomDatePickerPanel
          viewMonth={calendarMonth}
          onViewMonthChange={setCalendarMonth}
          pendingSelection={pendingCalendarDate}
          valueSelection={selectedDate}
          onSelectDay={(d) => setPendingCalendarDate(d)}
          onWheelMonthColumn={onWheelMonthColumn}
          onWheelYearColumn={onWheelYearColumn}
          onWheelGrid={onCalendarWheel}
          strings={str}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-slate-700 pt-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            <button
              type="button"
              className="rounded border border-slate-600 bg-slate-800/90 px-2 py-1.5 text-[10px] font-medium text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
              onMouseDown={(e) => e.preventDefault()}
              onClick={pickTodayDate}
            >
              {str.today}
            </button>
            <button
              type="button"
              className="rounded border border-slate-600 bg-slate-800/90 px-2 py-1.5 text-[10px] font-medium text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
              onMouseDown={(e) => e.preventDefault()}
              onClick={pickTomorrowDate}
            >
              {str.tomorrow}
            </button>
            {extraShortcuts.map((s) => (
              <button
                key={s.symbolic}
                type="button"
                className="rounded border border-slate-600 bg-slate-800/90 px-2 py-1.5 text-[10px] font-medium text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => emitSymbolic(s.symbolic)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              className="rounded border border-slate-500/80 bg-slate-800/90 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-500/50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancelCalendarEditing}
            >
              {str.cancel}
            </button>
            <button
              type="button"
              disabled={!canApplySelection}
              className="rounded border border-amber-500/70 bg-amber-950/50 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/55 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyCalendarSelection()}
            >
              {str.apply}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className={`relative inline-flex min-w-0 max-w-full flex-col gap-0 ${className}`}>
      <div ref={anchorRef} className="flex min-w-0 items-center gap-0.5">
        <input
          type="text"
          disabled={disabled}
          value={displayText}
          onChange={(e) => setTextEdit(e.target.value)}
          onFocus={() => setTextEdit(valueToInputDisplay(value))}
          onBlur={() => commitInput()}
          placeholder="gg/mm/aaaa"
          title="Data (gg/mm/aaaa), ISO, oppure Oggi / Domani"
          className={`min-w-0 flex-1 rounded border border-amber-400/40 bg-slate-900 px-2 py-1 text-[10px] text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60 ${inputClassName}`}
          onClick={() => {
            if (!disabled) setOpen(true);
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className="inline-flex shrink-0 rounded border border-amber-500/35 bg-slate-800 p-1 text-amber-300 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
          title={str.openCalendar}
          aria-haspopup="dialog"
          aria-expanded={open}
          onMouseDown={(e) => {
            e.preventDefault();
            toggleOpen();
          }}
        >
          <Calendar className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
