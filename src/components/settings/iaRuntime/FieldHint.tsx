/**
 * Label compatta con tooltip (title) per parametri runtime IA.
 */

import type { ReactNode } from 'react';

export type FieldHintVariant = 'muted' | 'clear';

/**
 * Classi label allineate tra sezioni (es. griglia Modello TTS | Voce).
 * @param layout `compact` = una riga con truncate; `wrap` = riga con più elementi (es. lingua cliccabile).
 */
export function runtimeIaFieldHintLabelClass(
  variant: FieldHintVariant,
  layout: 'compact' | 'wrap' = 'compact'
): string {
  const muted =
    'cursor-help border-b border-dotted border-slate-600 text-[10px] font-medium uppercase leading-none tracking-wide text-slate-500';
  const clear =
    'cursor-help border-b border-dotted border-violet-500/40 text-[11px] font-semibold leading-snug tracking-normal text-slate-200';
  const width =
    layout === 'compact'
      ? 'max-w-[14rem] truncate'
      : 'max-w-full min-w-0 flex flex-wrap items-baseline gap-x-0';
  return `${variant === 'clear' ? clear : muted} ${width}`;
}

export interface FieldHintProps {
  label: string;
  /** Testo tooltip: cosa fa, impatto, quando regolare. */
  tooltip: string;
  className?: string;
  children: ReactNode;
  /** muted = tipico parametri tecnici; clear = etichette leggibili (non grigie). */
  variant?: FieldHintVariant;
}

export function FieldHint({
  label,
  tooltip,
  className = '',
  children,
  variant = 'muted',
}: FieldHintProps) {
  return (
    <label className={`flex min-w-0 flex-col gap-0 ${className}`}>
      <span title={tooltip} className={runtimeIaFieldHintLabelClass(variant, 'compact')}>
        {label}
      </span>
      {children}
    </label>
  );
}
