/**
 * Lightweight collapsible block for unified Interface / flow side panels.
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function CollapsiblePanelSection({
  title,
  defaultOpen = true,
  className = '',
  headerClassName = '',
  /** Applied to the open content wrapper (default keeps nested flex layouts scroll-safe). */
  contentClassName = 'overflow-hidden',
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`flex min-h-0 min-w-0 flex-col rounded-lg border border-slate-700/55 bg-[#080a0d]/90 ${className}`}>
      <button
        type="button"
        className={`flex w-full shrink-0 items-center gap-2 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-800/50 ${headerClassName}`}
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
