/**
 * Titolo sezione compatto con badge override opzionale (padding minimo).
 */

import React from 'react';

export interface SectionChromeProps {
  title: string;
  showOverride?: boolean;
  children?: React.ReactNode;
}

export function SectionChrome({ title, showOverride, children }: SectionChromeProps) {
  return (
    <div className="inline-block max-w-full rounded border border-slate-700/80 bg-slate-900/60 px-2 py-1">
      <div className="flex flex-row flex-wrap items-center gap-2 gap-y-0">
        <h3 className="text-xs font-semibold leading-none text-slate-100">{title}</h3>
        {showOverride ? (
          <span className="rounded border border-amber-500/35 bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
            override
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
