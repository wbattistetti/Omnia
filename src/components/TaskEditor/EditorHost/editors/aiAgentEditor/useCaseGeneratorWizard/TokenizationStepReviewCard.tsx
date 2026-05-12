/**
 * Pannello destro passo 3 «Tokenizzazione»: heading + istruzioni + pulsanti
 * `Tokenizza` (AI) e `Vai al passo successivo`.
 *
 * Coerente con il pattern del Passo 1: pulsanti uniformi a piena larghezza, spinner per-button
 * sull'azione AI, advance step in fondo. La «Affina tokenizzazione modificata» (versione AI del
 * proofread per le frasi tokenizzate dal designer) NON è inclusa: la correzione manuale è
 * sufficiente per l'MVP.
 */

import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { wizardTutorialHeadingPill } from './wizardCardStyles';

export interface TokenizationStepReviewCardProps {
  panelHeading: string;
  /** Numero use case tokenizzati su totale: aiuta il designer a capire quanto c'è da rivedere. */
  tokenizedCount: number;
  totalUseCases: number;
  /** Se ≥ 1 use case ha la tokenizzazione editata vs baseline AI: cambia il copy del CTA. */
  hasManualEdits: boolean;
  tokenizeBusy: boolean;
  onTokenize?: () => void | Promise<void>;
  onAdvanceStep?: () => void;
  canAdvanceStep: boolean;
  advanceStepAnchorRef: React.RefObject<HTMLButtonElement | null>;
}

const BTN_UNIFORM =
  'flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/45 bg-slate-900/90 px-3 py-2.5 text-xs font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-violet-400/55 hover:bg-slate-800/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-45';

export function TokenizationStepReviewCard({
  panelHeading,
  tokenizedCount,
  totalUseCases,
  hasManualEdits,
  tokenizeBusy,
  onTokenize,
  onAdvanceStep,
  canAdvanceStep,
  advanceStepAnchorRef,
}: TokenizationStepReviewCardProps): React.ReactElement {
  const allTokenized = totalUseCases > 0 && tokenizedCount >= totalUseCases;
  const tokenizeLabel = allTokenized
    ? 'Ritokenizza con l’AI'
    : tokenizedCount === 0
      ? 'Tokenizza con l’AI'
      : 'Completa la tokenizzazione';

  /**
   * Azioni *complementari* alla tokenizzazione AI. L'azione principale «far tokenizzare
   * dall'AI» NON è più nell'elenco: è già il pulsante CTA sotto, ripeterla qui era
   * ridondante.
   */
  const actions: readonly { emoji: string; label: string }[] = [
    {
      emoji: '✏️',
      label: 'rivedere e correggere manualmente i placeholder dove serve',
    },
    {
      emoji: '🔁',
      label: 'rigenerare la tokenizzazione se hai fatto modifiche alle frasi',
    },
  ];

  return (
    <div className="rounded-xl border border-violet-500/35 bg-slate-900/55 shadow-[inset_0_1px_0_rgba(167,139,250,0.08)]">
      <div className="space-y-4 p-4">
        <h3 className={wizardTutorialHeadingPill('tokenization')}>{panelHeading}</h3>

        <p className="text-xs font-medium leading-relaxed text-slate-200">
          {totalUseCases === 0
            ? 'Non ci sono casi d’uso da tokenizzare. Torna al Passo 1 per generare la lista.'
            : tokenizedCount === 0
              ? 'Puoi tokenizzare tutte le frasi canoniche per schematizzare lo slot filling. Puoi comunque:'
              : `Ho tokenizzato ${tokenizedCount} di ${totalUseCases} frasi.${
                  hasManualEdits ? ' Hai modificato manualmente almeno una tokenizzazione.' : ''
                } Puoi comunque:`}
        </p>

        <ul
          className="ml-1 space-y-2 border-l-2 border-violet-500/30 pl-4 text-xs leading-relaxed text-slate-200"
          aria-label="Azioni complementari alla tokenizzazione AI"
        >
          {actions.map(({ emoji, label }) => (
            <li key={label} className="flex gap-2.5 py-0.5">
              <span className="shrink-0 select-none" aria-hidden>
                {emoji}
              </span>
              <span className="min-w-0">{label}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-slate-700/55 pt-4">
          {typeof onTokenize === 'function' && totalUseCases > 0 ? (
            <button
              type="button"
              aria-busy={tokenizeBusy}
              disabled={tokenizeBusy}
              onClick={() => void onTokenize()}
              className={BTN_UNIFORM}
            >
              <span className="flex min-h-[1.25rem] w-full items-center justify-center gap-2">
                {tokenizeBusy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span>{tokenizeBusy ? 'Tokenizzando…' : tokenizeLabel}</span>
              </span>
            </button>
          ) : null}

          {canAdvanceStep ? (
            <button
              ref={advanceStepAnchorRef}
              type="button"
              disabled={!canAdvanceStep}
              onClick={() => onAdvanceStep?.()}
              className={BTN_UNIFORM}
              /**
               * Tokenizzazione è l'ULTIMO step della pipeline (pipeline ridotta da 4 a 3 step).
               * Quindi il pulsante non «avanza» a un passo successivo, ma marca la conclusione
               * del wizard. Il copy «Concludi» è asciutto e coerente con l'aspettativa UX.
               */
            >
              Concludi
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
