/**
 * Label compatta con tooltip (title) per parametri runtime IA.
 */

import type { ReactNode } from 'react';

export interface FieldHintProps {
  label: string;
  /** Testo tooltip: cosa fa, impatto, quando regolare. */
  tooltip: string;
  className?: string;
  children: ReactNode;
  /** muted = tipico parametri tecnici; clear = etichette leggibili (non grigie). */
  variant?: 'muted' | 'clear';
}

export function FieldHint({
  label,
  tooltip,
  className = '',
  children,
  variant = 'muted',
}: FieldHintProps) {
  const labelCls =
    variant === 'clear'
      ? 'max-w-[14rem] cursor-help truncate border-b border-dotted border-violet-500/40 text-[11px] font-semibold leading-snug tracking-normal text-slate-200'
      : 'max-w-[14rem] cursor-help truncate border-b border-dotted border-slate-600 text-[10px] font-medium uppercase leading-none tracking-wide text-slate-500';

  return (
    <label className={`flex min-w-0 flex-col gap-0 ${className}`}>
      <span title={tooltip} className={labelCls}>
        {label}
      </span>
      {children}
    </label>
  );
}
