/**
 * Payoff sotto scenario: avviso sovrapposizione semantica (post analisi o creazione manuale).
 */

import React from 'react';
import type { UseCaseOverlapHint } from '@domain/aiAgentUseCase/useCaseSemanticOverlap';
import { formatOverlapDesignerMessage } from '@domain/aiAgentUseCase/useCaseSemanticOverlap';
import { buildUseCaseCatalogNumberById } from '@domain/aiAgentUseCase/useCaseCatalogNumber';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { isUseCaseIncludedInConversations } from '@types/aiAgentUseCases';

export type UseCaseOverlapPayoffProps = {
  readonly hint?: UseCaseOverlapHint;
  readonly analyzing?: boolean;
  readonly catalogUseCases: readonly AIAgentUseCase[];
};

export function UseCaseOverlapPayoff({
  hint,
  analyzing = false,
  catalogUseCases,
}: UseCaseOverlapPayoffProps): React.ReactElement | null {
  if (analyzing) {
    return (
      <p className="mt-1.5 text-[11px] leading-snug text-slate-500 italic" role="status">
        Verifica sovrapposizioni con il catalogo…
      </p>
    );
  }
  if (!hint) return null;

  const included = catalogUseCases.filter(isUseCaseIncludedInConversations);
  const numberById = buildUseCaseCatalogNumberById(included);
  const message =
    hint.designerMessage.trim() ||
    formatOverlapDesignerMessage(hint, numberById);

  if (hint.classification === 'new' && !message) return null;
  if (hint.classification === 'new' && hint.related.length === 0 && hint.score < 0.5) {
    return null;
  }
  if (!message.trim()) return null;

  const tone =
    hint.classification === 'duplicate'
      ? 'border-amber-500/40 bg-amber-950/35 text-amber-100/95'
      : hint.classification === 'variant'
        ? 'border-orange-500/35 bg-orange-950/30 text-orange-100/95'
        : 'border-slate-600/35 bg-slate-900/40 text-slate-400';

  return (
    <p
      className={`mt-1.5 rounded-md border px-2 py-1 text-[11px] leading-snug ${tone}`}
      role="status"
    >
      {message}
    </p>
  );
}
