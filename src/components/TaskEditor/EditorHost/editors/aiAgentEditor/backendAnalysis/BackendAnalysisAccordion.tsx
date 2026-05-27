/**
 * Accordion collassabile per sezioni analisi backend (L1 / L2).
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type BackendAnalysisAccordionProps = {
  title: React.ReactNode;
  defaultOpen?: boolean;
  /** Badge opzionale a destra del titolo (es. chip backend). */
  trailing?: React.ReactNode;
  children: React.ReactNode;
  level?: 1 | 2;
};

export function BackendAnalysisAccordion({
  title,
  defaultOpen = false,
  trailing,
  children,
  level = 1,
}: BackendAnalysisAccordionProps): React.ReactElement {
  const [open, setOpen] = React.useState(defaultOpen);
  const borderCls =
    level === 1
      ? 'border-slate-700/70 bg-slate-950/40'
      : 'border-slate-800/80 bg-slate-950/25';
  const titleCls = level === 1 ? 'text-sm font-semibold' : 'text-xs font-semibold';

  return (
    <div className={`rounded-md border ${borderCls}`}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-900/50"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
        <span className={`min-w-0 flex-1 text-slate-100 ${titleCls}`}>{title}</span>
        {trailing}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-800/80 px-3 py-3">{children}</div>
      ) : null}
    </div>
  );
}
