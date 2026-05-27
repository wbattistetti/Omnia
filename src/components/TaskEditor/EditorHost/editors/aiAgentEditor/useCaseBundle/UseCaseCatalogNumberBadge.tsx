/**
 * Badge numerazione catalogo (1..N) in lista use case — allineato a deploy e log `USECASE: "N — …"`.
 */

import React from 'react';
import { formatUseCaseCatalogNumberLabel } from '@domain/aiAgentUseCase/useCaseCatalogNumber';

export type UseCaseCatalogNumberBadgeProps = {
  readonly catalogNumber?: number;
  /** Use case incluso nel prompt / log runtime. */
  readonly included: boolean;
  /** `md` = colonna fissa in lista principale; `sm` = inline compatto. */
  readonly size?: 'sm' | 'md';
};

const SIZE_CLASS = {
  sm: 'h-[18px] min-w-[1.25rem] px-1 text-[10px]',
  md: 'h-6 min-w-[1.75rem] px-1.5 text-xs',
} as const;

export function UseCaseCatalogNumberBadge({
  catalogNumber,
  included,
  size = 'sm',
}: UseCaseCatalogNumberBadgeProps): React.ReactElement {
  const sizeCls = SIZE_CLASS[size];

  if (!included) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded border border-dashed border-slate-500/40 font-mono font-medium text-slate-500/80 dark:text-slate-500 ${sizeCls}`}
        title="Escluso dal catalogo deploy e dal log USECASE"
        aria-label="Use case escluso dal catalogo"
      >
        —
      </span>
    );
  }

  const n =
    typeof catalogNumber === 'number' && Number.isFinite(catalogNumber) && catalogNumber > 0
      ? Math.floor(catalogNumber)
      : 0;

  if (n <= 0) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded border border-dashed border-slate-500/35 font-mono text-slate-500 ${sizeCls}`}
        title="Numero catalogo non assegnato"
        aria-hidden
      >
        ·
      </span>
    );
  }

  const compact = formatUseCaseCatalogNumberLabel(n);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md border-2 border-violet-400/70 bg-violet-500/25 font-mono font-bold tabular-nums text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.35)] dark:border-violet-300/60 dark:bg-violet-600/30 dark:text-violet-50 ${sizeCls}`}
      title={`${compact} · log agente: USECASE: "${n} — …"`}
      aria-label={compact}
    >
      {n}
    </span>
  );
}
