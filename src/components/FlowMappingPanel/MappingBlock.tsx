/**
 * Mapping section: horizontal accent header + matching border around rounded frame (SEND/RECEIVE, INPUT/OUTPUT).
 */

import React from 'react';

export type MappingBlockAccent = 'send' | 'receive' | 'input' | 'output';

const ACCENT: Record<
  MappingBlockAccent,
  { headerClass: string; borderClass: string; label: string }
> = {
  send: {
    headerClass: 'bg-teal-500',
    borderClass: 'border-teal-500',
    label: 'SEND',
  },
  receive: {
    headerClass: 'bg-emerald-500',
    borderClass: 'border-emerald-500',
    label: 'RECEIVE',
  },
  input: {
    headerClass: 'bg-sky-500',
    borderClass: 'border-sky-500',
    label: 'INPUT',
  },
  output: {
    headerClass: 'bg-violet-500',
    borderClass: 'border-violet-500',
    label: 'OUTPUT',
  },
};

export interface MappingBlockProps {
  accent: MappingBlockAccent;
  /** Override header label (e.g. i18n) */
  labelOverride?: string;
  /** Layout: e.g. `w-full` (stacked) or `flex-1 min-w-0` (side-by-side columns). */
  rootClassName?: string;
  /** e.g. draggable “Parameter” chip for backend */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}

/** Max body height before vertical scroll; keeps panels short when few rows. */
const BODY_MAX_H = 'max-h-[min(60vh,420px)]';

export function MappingBlock({
  accent,
  labelOverride,
  rootClassName = '',
  headerExtra,
  children,
}: MappingBlockProps) {
  const { headerClass, borderClass, label } = ACCENT[accent];
  const text = labelOverride ?? label;

  return (
    <div
      className={`flex flex-col rounded-xl border-2 ${borderClass} overflow-hidden min-w-0 bg-[#0a0c10] shadow-inner ${rootClassName}`}
    >
      <header
        className={`shrink-0 px-3 py-2 ${headerClass} border-b border-black/10 flex items-center gap-2 min-h-[2.5rem]`}
      >
        <span className="text-xs font-bold tracking-wide text-slate-950 uppercase select-none">
          {text}
        </span>
        {headerExtra != null && <div className="ml-auto shrink-0">{headerExtra}</div>}
      </header>
      <div
        className={`min-h-0 min-w-0 p-2.5 overflow-y-auto overflow-x-hidden ${BODY_MAX_H}`}
      >
        {children}
      </div>
    </div>
  );
}
