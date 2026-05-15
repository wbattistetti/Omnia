/**
 * Indicatori minimi per riga use case nella lista composer: escluso / incompleto, oppure
 * accesso «Vedi compilato» quando disponibile. Stato deploy dettagliato (chip) rimosso dalla UI.
 */

import React from 'react';
import { Eye, Ban, AlertCircle } from 'lucide-react';
import type { UseCaseDeployRowStats } from './useCaseBundleDeployStats';

export interface UseCaseRowDeployChipsProps {
  stats: UseCaseDeployRowStats;
  onInspectCompiled?: () => void;
}

export function UseCaseRowDeployChips({
  stats,
  onInspectCompiled,
}: UseCaseRowDeployChipsProps): React.ReactElement | null {
  if (!stats.included) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded border border-slate-600/80 bg-slate-900/80 px-1 py-0.5 text-[9px] font-medium text-slate-400"
        title="Escluso da conversazioni e prompt finale"
      >
        <Ban className="h-2.5 w-2.5 shrink-0" aria-hidden />
        escluso
      </span>
    );
  }

  if (!stats.projectable) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded border border-rose-600/45 bg-rose-950/40 px-1 py-0.5 text-[9px] font-medium text-rose-200"
        title="Messaggio canonico mancante o non compilabile"
      >
        <AlertCircle className="h-2.5 w-2.5 shrink-0" aria-hidden />
        incompleto
      </span>
    );
  }

  if (!onInspectCompiled) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInspectCompiled();
        }}
        className="inline-flex items-center gap-0.5 rounded border border-slate-600/70 bg-slate-800/80 px-1 py-0.5 text-[9px] text-slate-300 hover:border-violet-500/50 hover:text-violet-200"
        title="Vedi compilato per questo use case"
      >
        <Eye className="h-2.5 w-2.5 shrink-0" aria-hidden />
      </button>
    </span>
  );
}
