/**
 * Lightweight collapsible block for unified Interface / flow side panels.
 * Supporta modalità controllata (`open` / `onOpenChange`) e header personalizzabile.
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const HEADER_TONE: Record<
  'sky' | 'violet' | 'amber' | 'emerald' | 'slate',
  string
> = {
  sky: 'border-b border-sky-500/25 bg-sky-500/[0.11] hover:bg-sky-500/[0.16]',
  violet: 'border-b border-violet-500/25 bg-violet-500/[0.11] hover:bg-violet-500/[0.16]',
  amber: 'border-b border-amber-500/25 bg-amber-500/[0.10] hover:bg-amber-500/[0.15]',
  emerald: 'border-b border-emerald-500/25 bg-emerald-500/[0.10] hover:bg-emerald-500/[0.15]',
  slate: 'border-b border-slate-600/35 bg-slate-600/[0.14] hover:bg-slate-600/[0.20]',
};

export function CollapsiblePanelSection({
  title,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className = '',
  headerClassName = '',
  /** Sfondo header a bassa saturazione (solo riga titolo). */
  headerTone,
  /** Applied to the open content wrapper (default keeps nested flex layouts scroll-safe). */
  contentClassName = 'overflow-hidden',
  /** When false, nasconde il chevron di disclosure (header resta cliccabile). */
  showDisclosure,
  /** Override tipografia default del titolo (uppercase compatto). */
  headerTitleClassName,
  /** Header più basso e chevron più piccolo (mapping backend radice). */
  compact = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  headerClassName?: string;
  headerTone?: keyof typeof HEADER_TONE;
  contentClassName?: string;
  showDisclosure?: boolean;
  headerTitleClassName?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? Boolean(openProp) : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const toneCls = headerTone ? HEADER_TONE[headerTone] : 'border-b border-slate-700/40 bg-slate-800/35 hover:bg-slate-800/55';
  const titleTypography =
    headerTitleClassName ??
    'text-[11px] font-semibold uppercase tracking-wide text-slate-100 whitespace-normal break-words';
  const showChevron = showDisclosure !== false;
  const headerPad = compact ? 'gap-1 px-1.5 py-0.5' : 'gap-2 px-2 py-1.5';
  const chevronCls = compact
    ? `h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`
    : `h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`;
  return (
    <div className={`flex min-h-0 min-w-0 flex-col rounded-lg border border-slate-700/55 bg-[#080a0d]/90 ${className}`}>
      <button
        type="button"
        className={`flex w-full shrink-0 items-center justify-start text-left ${headerPad} ${titleTypography} ${toneCls} ${headerClassName}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {showChevron ? (
          <ChevronDown className={chevronCls} aria-hidden />
        ) : null}
        <span className="min-w-0 shrink text-left break-words">{title}</span>
      </button>
      {open ? (
        <div className={`min-h-0 min-w-0 flex-1 flex flex-col ${contentClassName}`}>{children}</div>
      ) : null}
    </div>
  );
}
