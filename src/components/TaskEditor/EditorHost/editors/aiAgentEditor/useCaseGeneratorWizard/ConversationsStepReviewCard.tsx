/**
 * Pannello DX passo 2 (conversations) — versione asciutta.
 *
 * Layout:
 *  - heading «Passo 2°: Conversazioni»
 *  - lead «Ho creato N conversazione/i di esempio, usando gli use cases disponibili.»
 *    (mostrato solo se ne esiste almeno una; altrimenti messaggio iniziale.)
 *  - elenco bullet `Puoi:` con icone (matita / pollice su / pollice giù / lampadina)
 *  - 3 pulsanti contestuali di creazione:
 *      • pollice su  → outcome=positive, allowSuggested=false
 *      • pollice giù → outcome=negative, allowSuggested=false
 *      • lampadina   → outcome=positive, allowSuggested=true
 *    (caso negative+suggested non raggiungibile da questa UI; semplificazione voluta).
 *  - pulsante «Correggi ortografia frasi modificate» se presenti edit (proofread)
 *  - pulsante «Passa al prossimo step»
 *
 * Mantiene la stessa visual style di {@link UseCaseListStepReviewCard}.
 */

import React from 'react';
import { Lightbulb, Loader2, Pencil, ThumbsDown, ThumbsUp } from 'lucide-react';
import type {
  UseCaseGeneratorWizardConversationOutcome,
} from '@domain/useCaseGeneratorWizard/types';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { MissingAiModelToast } from '@components/common/MissingAiModelToast';
import { LastAiCostBadge } from '@components/common/LastAiCostBadge';
import { AI_CALL_PURPOSE, type AiCallPurposeId } from '@domain/aiCalls/purposes';
import { wizardTutorialHeadingPill } from './wizardCardStyles';

export interface AssembleConversationInvocation {
  outcome: UseCaseGeneratorWizardConversationOutcome;
  allowSuggestedUseCases: boolean;
}

export interface ConversationsStepReviewCardProps {
  panelHeading: string;
  conversationsCount: number;
  /**
   * Crea una nuova conversazione con i parametri associati al pulsante cliccato.
   * Se assente i pulsanti di creazione non vengono renderizzati.
   */
  onCreateConversation?: (params: AssembleConversationInvocation) => void | Promise<void>;
  createBusy: boolean;
  /** Pulsante «Correggi ortografia frasi modificate» (proofread bubble agente modificate). */
  onProofread?: () => void | Promise<void>;
  showProofreadCta: boolean;
  proofreadBusy: boolean;
  /** Pulsante «Passa al prossimo step». */
  onAdvanceStep?: () => void;
  canAdvanceStep: boolean;
  advanceStepAnchorRef: React.RefObject<HTMLButtonElement | null>;
}

const BTN_UNIFORM =
  'flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/45 bg-slate-900/90 px-3 py-2.5 text-xs font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-violet-400/55 hover:bg-slate-800/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-45';

/** Bottoni «crea conversazione …» — più compatti, distinguibili a colpo d'occhio. */
const CREATE_BTN_BASE =
  'flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-45';

const CREATE_BTN_POSITIVE =
  'border-emerald-500/55 bg-emerald-950/45 text-emerald-100 hover:border-emerald-400/70 hover:bg-emerald-900/55 focus-visible:ring-emerald-500/60';
const CREATE_BTN_NEGATIVE =
  'border-rose-500/55 bg-rose-950/40 text-rose-100 hover:border-rose-400/70 hover:bg-rose-900/55 focus-visible:ring-rose-500/60';
const CREATE_BTN_SUGGESTED =
  'border-amber-500/55 bg-amber-950/35 text-amber-100 hover:border-amber-400/70 hover:bg-amber-900/45 focus-visible:ring-amber-500/60';

/** Identifica quale dei 3 pulsanti contestuali ha avviato la generazione corrente. */
type PendingCreateButtonId = 'positive' | 'negative' | 'suggested';

const CREATE_GERUND: Record<PendingCreateButtonId, string> = {
  positive: 'Creando conversazione positiva',
  negative: 'Creando conversazione negativa',
  suggested: 'Creando conversazione esplorativa',
};

const CREATE_LABEL: Record<PendingCreateButtonId, string> = {
  positive: 'Conversazione con chiusura positiva',
  negative: 'Conversazione con chiusura negativa',
  suggested: 'Conversazione con nuovi use case',
};

const CREATE_PURPOSE: Record<PendingCreateButtonId, AiCallPurposeId> = {
  positive: AI_CALL_PURPOSE.CONVERSATION_POSITIVE,
  negative: AI_CALL_PURPOSE.CONVERSATION_NEGATIVE,
  suggested: AI_CALL_PURPOSE.CONVERSATION_SUGGESTED,
};

export function ConversationsStepReviewCard({
  panelHeading,
  conversationsCount,
  onCreateConversation,
  createBusy,
  onProofread,
  showProofreadCta,
  proofreadBusy,
  onAdvanceStep,
  canAdvanceStep,
  advanceStepAnchorRef,
}: ConversationsStepReviewCardProps): React.ReactElement {
  const hasConversations = conversationsCount > 0;
  const canCreate = typeof onCreateConversation === 'function';

  const { busyLabel, hasModel } = useAiBusyLabel();
  const [showNoModelToast, setShowNoModelToast] = React.useState(false);

  React.useEffect(() => {
    if (hasModel && showNoModelToast) {
      setShowNoModelToast(false);
    }
  }, [hasModel, showNoModelToast]);

  /**
   * `createBusy` è globale (riflette la richiesta in volo verso il backend). Per mostrare lo
   * spinner solo sul pulsante cliccato — e non su tutti e tre — tracciamo localmente quale
   * pulsante ha avviato la generazione. Lo resettiamo quando `createBusy` torna false.
   */
  const [pendingButton, setPendingButton] = React.useState<PendingCreateButtonId | null>(null);

  React.useEffect(() => {
    if (!createBusy && pendingButton !== null) {
      setPendingButton(null);
    }
  }, [createBusy, pendingButton]);

  const create = React.useCallback(
    (buttonId: PendingCreateButtonId, params: AssembleConversationInvocation) => {
      if (!canCreate || createBusy) return;
      if (!hasModel) {
        setShowNoModelToast(true);
        return;
      }
      setPendingButton(buttonId);
      void onCreateConversation?.(params);
    },
    [canCreate, createBusy, hasModel, onCreateConversation]
  );

  const renderCreateLabel = (buttonId: PendingCreateButtonId): string =>
    pendingButton === buttonId && createBusy
      ? busyLabel(CREATE_GERUND[buttonId])
      : CREATE_LABEL[buttonId];

  const handleProofreadClick = (): void => {
    if (!hasModel) {
      setShowNoModelToast(true);
      return;
    }
    void onProofread?.();
  };

  return (
    <div className="rounded-xl border border-violet-500/35 bg-slate-900/55 shadow-[inset_0_1px_0_rgba(167,139,250,0.08)]">
      <div className="space-y-4 p-4">
        <h3 className={wizardTutorialHeadingPill('conversations')}>{panelHeading}</h3>

        <p className="text-xs leading-relaxed text-slate-200">
          {hasConversations ? (
            <>
              Ci sono{' '}
              <span className="tabular-nums font-semibold text-amber-100">
                {conversationsCount}
              </span>{' '}
              {conversationsCount === 1
                ? 'conversazione esemplificativa.'
                : 'conversazioni esemplificative.'}
            </>
          ) : (
            <>
              Crea le prime conversazioni di esempio mescolando gli use cases disponibili.
            </>
          )}
        </p>

        <div className="space-y-1.5 text-xs leading-relaxed text-slate-200">
          <p className="font-medium text-slate-100">Puoi:</p>
          <ul
            className="ml-1 space-y-2 border-l-2 border-violet-500/30 pl-3 text-slate-200"
            aria-label="Azioni del passo conversazioni"
          >
            <li className="flex items-start gap-2 py-0.5">
              <Pencil size={13} className="mt-0.5 shrink-0 text-violet-300" aria-hidden />
              <span className="min-w-0">
                modificare i testi delle risposte che dovrà usare l&apos;agente
              </span>
            </li>
            <li className="flex flex-col gap-1 py-0.5">
              <span className="text-slate-300">
                cliccando sui pulsanti sotto, puoi creare nuove conversazioni:
              </span>
              <ul className="ml-1 space-y-1 border-l border-slate-700/65 pl-3">
                <li className="flex items-start gap-2">
                  <ThumbsUp size={13} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
                  <span className="min-w-0">con chiusura positiva: task riuscito</span>
                </li>
                <li className="flex items-start gap-2">
                  <ThumbsDown size={13} className="mt-0.5 shrink-0 text-rose-300" aria-hidden />
                  <span className="min-w-0">con chiusura negativa: task non riuscito</span>
                </li>
                <li className="flex items-start gap-2">
                  <Lightbulb size={13} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
                  <span className="min-w-0">
                    con proposta di use cases mancanti
                    <span className="text-slate-400"> (solo per chiusura positiva)</span>
                  </span>
                </li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-700/55 pt-4">
          {canCreate ? (
            <>
              <button
                type="button"
                aria-busy={pendingButton === 'positive'}
                disabled={createBusy}
                onClick={() =>
                  create('positive', { outcome: 'positive', allowSuggestedUseCases: false })
                }
                className={`${CREATE_BTN_BASE} ${CREATE_BTN_POSITIVE}`}
                title="Crea una conversazione con chiusura positiva (accettazione/conferma)."
              >
                {pendingButton === 'positive' ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <ThumbsUp size={14} aria-hidden />
                )}
                <span>{renderCreateLabel('positive')}</span>
                {pendingButton !== 'positive' || !createBusy ? (
                  <LastAiCostBadge purpose={CREATE_PURPOSE.positive} />
                ) : null}
              </button>
              <button
                type="button"
                aria-busy={pendingButton === 'negative'}
                disabled={createBusy}
                onClick={() =>
                  create('negative', { outcome: 'negative', allowSuggestedUseCases: false })
                }
                className={`${CREATE_BTN_BASE} ${CREATE_BTN_NEGATIVE}`}
                title="Crea una conversazione con chiusura negativa (date esaurite o abbandono educato)."
              >
                {pendingButton === 'negative' ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <ThumbsDown size={14} aria-hidden />
                )}
                <span>{renderCreateLabel('negative')}</span>
                {pendingButton !== 'negative' || !createBusy ? (
                  <LastAiCostBadge purpose={CREATE_PURPOSE.negative} />
                ) : null}
              </button>
              <button
                type="button"
                aria-busy={pendingButton === 'suggested'}
                disabled={createBusy}
                onClick={() =>
                  create('suggested', { outcome: 'positive', allowSuggestedUseCases: true })
                }
                className={`${CREATE_BTN_BASE} ${CREATE_BTN_SUGGESTED}`}
                title="Crea una conversazione (chiusura positiva) in cui l'AI può proporre fino a 1 use case emergente per riempire un buco di catalogo."
              >
                {pendingButton === 'suggested' ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Lightbulb size={14} aria-hidden />
                )}
                <span>{renderCreateLabel('suggested')}</span>
                {pendingButton !== 'suggested' || !createBusy ? (
                  <LastAiCostBadge purpose={CREATE_PURPOSE.suggested} />
                ) : null}
              </button>
            </>
          ) : null}

          {showNoModelToast ? (
            <MissingAiModelToast onDismiss={() => setShowNoModelToast(false)} />
          ) : null}

          {showProofreadCta && typeof onProofread === 'function' ? (
            <button
              type="button"
              aria-busy={proofreadBusy}
              disabled={proofreadBusy}
              onClick={handleProofreadClick}
              className={BTN_UNIFORM}
            >
              <span className="flex min-h-[1.25rem] w-full flex-col items-center justify-center gap-1">
                <span className="flex items-center justify-center gap-2">
                  {proofreadBusy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : null}
                  <span>
                    {proofreadBusy
                      ? busyLabel('Correggendo ortografia')
                      : 'Correggi ortografia frasi modificate'}
                  </span>
                  {!proofreadBusy ? (
                    <LastAiCostBadge purpose={AI_CALL_PURPOSE.CONVERSATION_PROOFREAD} />
                  ) : null}
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
              Passa al prossimo step
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
