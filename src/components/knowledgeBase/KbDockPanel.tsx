/**
 * Docked side panel shell (title + close) for KB reader / chat.
 */

import React from 'react';
import { X } from 'lucide-react';

export type KbDockPanelProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export function KbDockPanel({
  title,
  onClose,
  children,
  className = '',
}: KbDockPanelProps): React.ReactElement {
  return (
    <section
      className={
        'flex min-h-0 min-w-[200px] flex-col overflow-hidden border-l border-slate-800 bg-slate-950/80 ' +
        className
      }
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-2 py-1.5">
        <span className="font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          aria-label={`Chiudi ${title}`}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">{children}</div>
    </section>
  );
}
