/**
 * Badge numerazione catalogo (1..N) in lista use case — allineato a deploy e log `USECASE: "N — …"`.
 */

import React from 'react';
import { formatUseCaseCatalogNumberLabel } from '@domain/aiAgentUseCase/useCaseCatalogNumber';

export type UseCaseCatalogNumberBadgeProps = {
  readonly catalogNumber?: number;
  /** Use case incluso nel prompt / log runtime. */
  readonly included: boolean;
};

export function UseCaseCatalogNumberBadge({
  catalogNumber,
  included,
}: UseCaseCatalogNumberBadgeProps): React.ReactElement | null {
  if (!included) {
    return (
      <span
        className="mt-[2px] inline-flex h-[18px] min-w-[1.25rem] shrink-0 items-center justify-center rounded border border-dashed border-slate-500/35 px-1 font-mono text-[10px] font-medium text-slate-500/80 dark:text-slate-500"
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
  if (n <= 0) return null;

  const compact = formatUseCaseCatalogNumberLabel(n);
  return (
    <span
      className="mt-[2px] inline-flex h-[18px] min-w-[1.25rem] shrink-0 items-center justify-center rounded border border-violet-500/50 bg-violet-100/90 px-1 font-mono text-[10px] font-bold tabular-nums text-violet-900 shadow-sm dark:border-violet-400/45 dark:bg-violet-950/55 dark:text-violet-100"
      title={`${compact} · nel log agente: USECASE: "${n} — …"`}
      aria-label={`${compact}`}
    >
      {n}
    </span>
  );
}
