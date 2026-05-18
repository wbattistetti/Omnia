/**
 * Pannello destro passo 1 (lista use case): titolo → intro → lista (emoji + testo, dentata) → pulsanti verticali uniformi.
 */

import React from 'react';
import { Loader2, X } from 'lucide-react';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { MissingAiModelToast } from '@components/common/MissingAiModelToast';
import { LastAiCostBadge } from '@components/common/LastAiCostBadge';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { wizardTutorialHeadingPill } from './wizardCardStyles';
import { UseCaseGenerationStyleField } from './UseCaseGenerationStyleField';

export interface UseCaseListStepReviewCardProps {
  useCaseCount: number;
  panelHeading: string;
  /** Mostra voce 💬 + pulsante «Omogeneizza messaggi». */
  showStyleHint: boolean;
  styleBusy: boolean;
  /** Testo pulsante durante loading (es. progress batch); default «Omogeneizzando…». */
  styleBusyLabel?: string;
  onApplyStyle?: () => void | Promise<void>;
  bundleFeedback: string | null;
  onDismissBundleFeedback?: () => void;
  generateBusy: boolean;
  /** Etichetta pulsante durante generazione (es. «Generando use case… (12)»). */
  generateBusyLabel?: string;
  onGenerateMore?: () => void;
  canGenerateMore: boolean;
  onAdvanceStep?: () => void;
  canAdvanceStep: boolean;
  advanceStepAnchorRef: React.RefObject<HTMLButtonElement | null>;
  /** Contratto stile effettivo per le prossime chiamate «genera / crea altri». */
  generationStyleContract: string;
  onGenerationStyleContractChange: (next: string) => void;
  styleFieldDisabled?: boolean;
}

const BTN_UNIFORM =
  'flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/45 bg-slate-900/90 px-3 py-2.5 text-xs font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-violet-400/55 hover:bg-slate-800/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-45';

export function UseCaseListStepReviewCard({
  useCaseCount,
  panelHeading,
  showStyleHint,
  styleBusy,
  styleBusyLabel,
  onApplyStyle,
  bundleFeedback,
  onDismissBundleFeedback,
  generateBusy,
  generateBusyLabel,
  onGenerateMore,
  canGenerateMore,
  onAdvanceStep,
  canAdvanceStep,
  advanceStepAnchorRef,
  generationStyleContract,
  onGenerationStyleContractChange,
  styleFieldDisabled = false,
}: UseCaseListStepReviewCardProps): React.ReactElement {
  const n = Math.max(0, useCaseCount);

  const baseActions: readonly { emoji: string; label: string }[] = [
    { emoji: '✏️', label: 'correggere le etichette che ho assegnato' },
    { emoji: '📘', label: 'rivedere gli scenari descritti' },
    { emoji: '➕', label: 'aggiungere manualmente nuovi casi d’uso' },
    { emoji: '🗑️', label: 'eliminare quelli che non ti sembrano appropriati' },
  ];

  return (
    <div className="rounded-xl border border-violet-500/35 bg-slate-900/55 shadow-[inset_0_1px_0_rgba(167,139,250,0.08)]">
      <div className="space-y-4 p-4">
        <h3 className={wizardTutorialHeadingPill('use_case_list')}>{panelHeading}</h3>

        {bundleFeedback ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-2 text-xs leading-snug text-emerald-50">
            <span className="min-w-0 flex-1">{bundleFeedback}</span>
            {typeof onDismissBundleFeedback === 'function' ? (
              <button
                type="button"
                aria-label="Chiudi messaggio"
                className="shrink-0 rounded p-0.5 text-emerald-200/90 hover:bg-emerald-900/55 hover:text-emerald-50"
                onClick={() => onDismissBundleFeedback()}
              >
                <X size={14} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs font-medium leading-relaxed text-slate-200">
          Ho creato {n} use case. Puoi:
        </p>

        <ul
          className="ml-1 space-y-2 border-l-2 border-violet-500/30 pl-4 text-xs leading-relaxed text-slate-200"
          aria-label="Azioni suggerite"
        >
          {baseActions.map(({ emoji, label }) => (
            <li key={label} className="flex gap-2.5 py-0.5">
              <span className="shrink-0 select-none" aria-hidden>
                {emoji}
              </span>
              <span className="min-w-0">{label}</span>
            </li>
          ))}
          {showStyleHint ? (
            <li className="flex gap-2.5 py-0.5">
              <span className="shrink-0 select-none" aria-hidden>
                💬
              </span>
              <span className="min-w-0 text-slate-100">
                Aggiornare i messaggi con lo stile delle tue ultime modifiche.
              </span>
            </li>
          ) : null}
        </ul>

        <div className="flex flex-col gap-2 border-t border-slate-700/55 pt-4">
          <UseCaseGenerationStyleField
            value={generationStyleContract}
            onChange={onGenerationStyleContractChange}
            disabled={styleFieldDisabled}
          />
          {canGenerateMore ? (
            <UseCaseListGenerateButton
              generateBusy={generateBusy}
              generateBusyLabel={generateBusyLabel}
              onGenerateMore={onGenerateMore}
            />
          ) : null}

          {showStyleHint && typeof onApplyStyle === 'function' ? (
            <button
              type="button"
              aria-busy={styleBusy}
              disabled={styleBusy}
              onClick={() => void onApplyStyle()}
              className={BTN_UNIFORM}
            >
              <span className="flex min-h-[1.25rem] w-full flex-col items-center justify-center gap-1">
                <span className="flex items-center justify-center gap-2">
                  {styleBusy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : null}
                  <span>
                    {styleBusy ? styleBusyLabel ?? 'Omogeneizzando…' : 'Omogeneizza messaggi'}
                  </span>
                </span>
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
            >
              Vai al passo successivo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * CTA "Crea altri use case" con guard sul modello globale.
 * Estratto come sub-componente per isolare lo stato locale del toast (single responsibility).
 */
function UseCaseListGenerateButton({
  generateBusy,
  generateBusyLabel,
  onGenerateMore,
}: {
  generateBusy: boolean;
  generateBusyLabel?: string;
  onGenerateMore?: () => void | Promise<void>;
}): React.ReactElement {
  const { hasModel } = useAiBusyLabel();
  const [showNoModelToast, setShowNoModelToast] = React.useState(false);

  React.useEffect(() => {
    if (hasModel && showNoModelToast) {
      setShowNoModelToast(false);
    }
  }, [hasModel, showNoModelToast]);

  const handleClick = (): void => {
    if (!hasModel) {
      setShowNoModelToast(true);
      return;
    }
    void onGenerateMore?.();
  };

  return (
    <>
      <button
        type="button"
        aria-busy={generateBusy}
        disabled={generateBusy || typeof onGenerateMore !== 'function'}
        onClick={handleClick}
        className={BTN_UNIFORM}
      >
        <span className="flex min-h-[1.25rem] w-full flex-col items-center justify-center gap-1">
          <span className="flex items-center justify-center gap-2">
            {generateBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : null}
            <span>
              {generateBusy
                ? (generateBusyLabel ?? 'Generando use case…')
                : 'Crea altri use case'}
            </span>
            {!generateBusy ? (
              <LastAiCostBadge purpose={AI_CALL_PURPOSE.USE_CASE_GENERATE_MORE} />
            ) : null}
          </span>
        </span>
      </button>
      {showNoModelToast ? (
        <MissingAiModelToast onDismiss={() => setShowNoModelToast(false)} />
      ) : null}
    </>
  );
}
