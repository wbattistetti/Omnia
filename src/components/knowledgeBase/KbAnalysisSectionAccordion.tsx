/**
 * Header accordion per sezione analisi KB (titolo maiuscolo colorato).
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type KbAnalysisSectionAccordionProps = {
  heading: string;
  defaultOpen?: boolean;
  badge?: string;
  headingToneClass?: string;
  children: React.ReactNode;
};

export function KbAnalysisSectionAccordion({
  heading,
  defaultOpen = false,
  badge,
  headingToneClass = 'text-cyan-300/90',
  children,
}: KbAnalysisSectionAccordionProps): React.ReactElement {
  const [open, setOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    setOpen(defaultOpen);
  }, [heading, defaultOpen]);

  return (
    <div className="rounded border border-slate-800/80 bg-slate-950/30">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-slate-900/50"
      >
        {open ? (
          <ChevronDown size={14} className="shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden />
        )}
        <span
          className={`min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wide ${headingToneClass}`}
        >
          {heading}
        </span>
        {badge ? (
          <span className="shrink-0 rounded bg-teal-950/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-teal-200/90">
            {badge}
          </span>
        ) : null}
      </button>
      {open ? <div className="border-t border-slate-800/70 px-2 pb-2 pt-1">{children}</div> : null}
    </div>
  );
}
