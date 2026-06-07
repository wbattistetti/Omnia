/**
 * Chip ruolo UC dialogo KB in lista composer (acquisizione / correzione / complete).
 */

import React from 'react';
import type { KbDialogUseCaseMeta } from '@domain/knowledgeBase/kbDialog/kbDialogTypes';
import { humanizeSelectorAskLabel } from '@domain/knowledgeBase/kbSelectorSpec';

export type KbDialogUseCaseRoleChipsProps = {
  meta: KbDialogUseCaseMeta | undefined;
  selectorHeaderLabel?: string;
};

export function KbDialogUseCaseRoleChips({
  meta,
  selectorHeaderLabel,
}: KbDialogUseCaseRoleChipsProps): React.ReactElement | null {
  if (!meta?.kind) return null;

  if (meta.kind === 'acquisition') {
    const label =
      selectorHeaderLabel ??
      (meta.selectorColumnId ? humanizeSelectorAskLabel(meta.selectorColumnId) : 'dato');
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded border border-sky-600/45 bg-sky-950/40 px-1 py-0.5 text-[9px] font-medium text-sky-100"
        title={`UC acquisizione: chiede ${meta.selectorColumnId ?? 'selettore'}`}
      >
        Dato mancante: {label}
      </span>
    );
  }

  if (meta.kind === 'correction') {
    return (
      <span
        className="inline-flex flex-wrap items-center gap-0.5"
        title="UC correzione slot dipendenti"
      >
        <span className="inline-flex rounded border border-amber-600/45 bg-amber-950/40 px-1 py-0.5 text-[9px] font-medium text-amber-100">
          Correzione
        </span>
        {meta.triggerColumnId ? (
          <span className="inline-flex rounded border border-slate-600/50 bg-slate-900/60 px-1 py-0.5 text-[9px] text-slate-300">
            trigger: {meta.triggerColumnId}
          </span>
        ) : null}
      </span>
    );
  }

  if (meta.kind === 'complete') {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded border border-emerald-600/45 bg-emerald-950/40 px-1 py-0.5 text-[9px] font-medium text-emerald-100"
        title="Template parametrico conferma binding completo"
      >
        Conferma · template parametrico
      </span>
    );
  }

  return null;
}
