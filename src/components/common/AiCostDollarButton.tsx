/**
 * Toolbar entry point for the AI cost log: a `$` icon button that opens `AiCallLogDialog`.
 *
 * Intentionally lean — keeps the toolbar surface free of state. The dialog itself owns its
 * data via `useAiCallLog`.
 */

import React from 'react';
import { DollarSign } from 'lucide-react';
import { AiCallLogDialog } from './AiCallLogDialog';

export interface AiCostDollarButtonProps {
  className?: string;
  title?: string;
}

export function AiCostDollarButton({
  className,
  title = 'Storico chiamate IA e costi',
}: AiCostDollarButtonProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const baseClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-emerald-300 hover:border-emerald-400/70 hover:bg-slate-700 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60';
  return (
    <>
      <button
        type="button"
        aria-label={title}
        title={title}
        className={className ? `${baseClass} ${className}` : baseClass}
        onClick={() => setOpen(true)}
      >
        <DollarSign size={14} aria-hidden />
      </button>
      <AiCallLogDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
