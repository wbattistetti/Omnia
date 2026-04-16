/**
 * Lightweight collapsible block for unified Interface / flow side panels.
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
  className = '',
  headerClassName = '',
  /** Sfondo header a bassa saturazione (solo riga titolo). */
  headerTone,
  /** Applied to the open content wrapper (default keeps nested flex layouts scroll-safe). */
  contentClassName = 'overflow-hidden',
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  headerTone?: keyof typeof HEADER_TONE;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneCls = headerTone ? HEADER_TONE[headerTone] : 'border-b border-slate-700/40 bg-slate-800/35 hover:bg-slate-800/55';
  return (
    <div className={`flex min-h-0 min-w-0 flex-col rounded-lg border border-slate-700/55 bg-[#080a0d]/90 ${className}`}>
      <button
        type="button"
        className={`flex w-full shrink-0 items-center gap-2 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-100 ${toneCls} ${headerClassName}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden
        />
        {title}
      </button>
      {open ? (
        <div className={`min-h-0 min-w-0 flex-1 flex flex-col ${contentClassName}`}>{children}</div>
      ) : null}
    </div>
  );
}
