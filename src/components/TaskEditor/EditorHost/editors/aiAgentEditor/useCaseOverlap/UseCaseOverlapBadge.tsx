/**
 * Badge classificazione overlap (Duplicato / Variante / Nuovo) su riga use case.
 */

import React from 'react';
import type { UseCaseOverlapHint } from '@domain/aiAgentUseCase/useCaseSemanticOverlap';
import { overlapClassificationLabel } from '@domain/useCaseOverlap/useCaseOverlapApi';

const TONE_CLASS: Record<UseCaseOverlapHint['classification'], string> = {
  duplicate:
    'border-amber-500/50 bg-amber-950/50 text-amber-100 dark:border-amber-400/45 dark:text-amber-50',
  variant:
    'border-orange-500/45 bg-orange-950/45 text-orange-100 dark:border-orange-400/40 dark:text-orange-50',
  new: 'border-slate-600/40 bg-slate-800/50 text-slate-400 dark:text-slate-500',
};

export type UseCaseOverlapBadgeProps = {
  readonly hint?: UseCaseOverlapHint;
  readonly analyzing?: boolean;
};

export function UseCaseOverlapBadge({
  hint,
  analyzing = false,
}: UseCaseOverlapBadgeProps): React.ReactElement | null {
  if (analyzing) {
    return (
      <span className="inline-flex shrink-0 items-center rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide border border-slate-500/40 bg-slate-800/60 text-slate-400">
        Overlap…
      </span>
    );
  }
  if (!hint) return null;
  if (hint.classification === 'new' && hint.score < 0.5 && hint.related.length === 0) {
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${TONE_CLASS.new}`}
        title="Nessuna sovrapposizione rilevante"
      >
        {overlapClassificationLabel('new')}
      </span>
    );
  }
  if (hint.classification === 'new' && hint.related.length === 0) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${TONE_CLASS[hint.classification]}`}
      title={hint.designerMessage || overlapClassificationLabel(hint.classification)}
    >
      {overlapClassificationLabel(hint.classification)}
    </span>
  );
}
