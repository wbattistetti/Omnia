/**
 * ViewSkaGenerator: shell con toolbar multi-riga (stepper + Riga 2 contestuale + Riga 3 al passo 2),
 * pannello SX solo lavoro, DX tutorial + azioni del passo.
 */

import React from 'react';
import { FileText, GraduationCap, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import { getUseCaseGeneratorWizardStepConfig, USE_CASE_GENERATOR_WIZARD_STEPS } from '@domain/useCaseGeneratorWizard/config';
import type { UseCaseGeneratorWizardStepId } from '@domain/useCaseGeneratorWizard/types';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { MissingAiModelToast } from '@components/common/MissingAiModelToast';
import { LastAiCostBadge } from '@components/common/LastAiCostBadge';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { LABEL_GENERATE_USE_CASES } from '../constants';
import type { UseCaseGeneratorWizardModel } from './useUseCaseGeneratorWizard';
import { UseCaseListStepReviewCard } from './UseCaseListStepReviewCard';
import {
  ConversationsStepReviewCard,
  type AssembleConversationInvocation,
} from './ConversationsStepReviewCard';
import { WizardAdvanceDialog } from './WizardAdvanceDialog';
import {
  WizardShowTokensToggle,
  WizardStepOneListToolbarControls,
} from './WizardStepOneListToolbar';
import { WizardConversationsTabsControls } from './WizardConversationsToolbarRows';
import { ClearAllWizardOutputDialog } from './ClearAllWizardOutputDialog';
import { ConversationalJsonPanel } from './ConversationalJsonPanel';
import { ConversationalPromptDialog } from './ConversationalPromptDialog';
import { areAllUseCasesProjectable } from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

const RIGHT_PANEL_WIDTH_STORAGE_KEY = 'omnia.aiAgent.useCaseWizard.rightPanelWidthPx';
const RIGHT_PANEL_MIN_PX = 250;
const RIGHT_PANEL_MAX_VIEWPORT_FRAC = 0.6;

type ClearWizardScope = 'use_case_list' | 'conversations' | 'tokenization';

const STEP_COLOR_THEME: Record<
  UseCaseGeneratorWizardStepId,
  {
    active: string;
    inactiveHover: string;
    workspace: string;
  }
> = {
  use_case_list: {
    active:
      'border-violet-400/95 bg-violet-950/55 text-amber-100 shadow-[0_0_22px_rgba(139,92,246,0.32)] ring-1 ring-inset ring-violet-300/25',
    inactiveHover: 'hover:border-violet-500/50 hover:bg-violet-950/25',
    workspace: 'bg-gradient-to-br from-violet-950/12 via-slate-950 to-slate-950',
  },
  conversations: {
    active:
      'border-sky-400/95 bg-sky-950/50 text-sky-50 shadow-[0_0_22px_rgba(56,189,248,0.30)] ring-1 ring-inset ring-sky-300/25',
    inactiveHover: 'hover:border-sky-500/50 hover:bg-sky-950/25',
    workspace: 'bg-gradient-to-br from-sky-950/12 via-slate-950 to-slate-950',
  },
  tokenization: {
    active:
      'border-amber-400/95 bg-amber-950/40 text-amber-50 shadow-[0_0_22px_rgba(245,158,11,0.28)] ring-1 ring-inset ring-amber-300/25',
    inactiveHover: 'hover:border-amber-500/45 hover:bg-amber-950/20',
    workspace: 'bg-gradient-to-br from-amber-950/10 via-slate-950 to-slate-950',
  },
};

/**
 * Altezza fissa dei pill dello stepper. Pre-allocata all'altezza del pill **più alto**
 * fra quelli espansi: il Passo 2 «Conversazioni», che contiene i cluster outcome
 * (`px-1.5 py-1` + bordo) con dentro le `ConversationTabButton` (`text-[11px] px-2 py-1`).
 * Misura: button ~27px → cluster 27 + py-1 (8px) + bordo (2px) = 37px → pill 37 +
 * py-1.5 (12px) + bordo (2px) = 51px. Arrotondiamo a **52px** per stabilità sub-pixel.
 *
 * Tutti i pill (collassati e attivi di qualunque passo) partono quindi con
 * `min-h-[52px]`: il click su un passo non causa **mai** un salto verticale, anche se
 * il passo selezionato è quello con i cluster.
 *
 * Per tutelare la garanzia anche sotto viewport stretti, l'active pill usa
 * `flex-nowrap` sui propri controlli (vedi sotto): se la barra non sta in larghezza,
 * a wrappare è il pill **intero** dentro il container (`gap-y-2`), non i suoi controlli.
 */
const STEP_PILL_MIN_HEIGHT = 'min-h-[52px]';

function clampRightAsideWidth(px: number, viewportWidth: number): number {
  const max = Math.max(
    RIGHT_PANEL_MIN_PX,
    Math.floor(viewportWidth * RIGHT_PANEL_MAX_VIEWPORT_FRAC)
  );
  return Math.min(Math.max(RIGHT_PANEL_MIN_PX, Math.round(px)), max);
}

function readInitialRightAsideWidth(): number {
  if (typeof window === 'undefined') return 380;
  const vw = window.innerWidth;
  let stored: number | null = null;
  try {
    const raw = sessionStorage.getItem(RIGHT_PANEL_WIDTH_STORAGE_KEY);
    if (raw) stored = parseInt(raw, 10);
  } catch {
    /* ignore */
  }
  const fallback = Math.min(420, Math.floor(vw * 0.44));
  const base =
    typeof stored === 'number' && Number.isFinite(stored) && stored >= RIGHT_PANEL_MIN_PX
      ? stored
      : fallback;
  return clampRightAsideWidth(base, vw);
}

export interface ViewSkaGeneratorProps {
  wizard: UseCaseGeneratorWizardModel;
  leftPanel: React.ReactNode;
  /** Solo passo 1: generazione lista use case — sempre nel pannello destro. */
  onGenerateUseCaseBundle?: () => void | Promise<void>;
  generateBusy?: boolean;
  /** Passo 1: mostra la toolbar lista (espandi/collassa, Mostra…) sotto lo stepper. */
  showStepOneListToolbar?: boolean;
  /** Numero use case corrente (testo «Ho creato n…» nel pannello DX dopo la prima generazione). */
  useCaseCount?: number;
  /** Passo 1 → 2: avanza nel wizard (dialog se nessuna modifica vs baseline). */
  onAdvanceWizardStep?: () => void;
  /** Messaggio dopo generazione batch (es. «Ho aggiunto N use case»). */
  bundleFeedback?: string | null;
  onDismissBundleFeedback?: () => void;
  /** Passo 1: applica stile dalle frasi modificate (omogeneizza messaggi). */
  onApplyExamplePhraseStyle?: () => void | Promise<void>;
  examplePhraseStyleBusy?: boolean;
  /** Avanzamento omogeneizzazione (current/total use case). */
  examplePhraseStyleBatchProgress?: { current: number; total: number } | null;
  /**
   * Passo 2 — Crea/aggiunge una conversazione (l'AI sceglie il mix di use case e i turni).
   * I parametri vengono dal pulsante cliccato nel pannello DX (pollice su/giù/lampadina).
   */
  onCreateConversation?: (params: AssembleConversationInvocation) => void | Promise<void>;
  createConversationBusy?: boolean;
  /** Passo 2 — Proofread (solo ortografia) sulle bubble agente modificate manualmente. */
  onProofreadConversationAgentTurns?: () => void | Promise<void>;
  proofreadConversationBusy?: boolean;
  /** @deprecated Tokenizzazione manuale rimossa: la compilazione avviene on-demand dal canonico. */
  onTokenizeUseCases?: () => void | Promise<void>;
  tokenizeUseCasesBusy?: boolean;
  /** @deprecated Mantenuto per compatibilità con vecchi caller. */
  tokenizedUseCaseCount?: number;
  /** @deprecated Mantenuto per compatibilità con vecchi caller. */
  tokenizationHasManualEdits?: boolean;
  /**
   * Pref globale «LLM manual handoff»: quando true, i pulsanti AI del wizard (generate use
   * cases / assemble conversation) aprono un modale di handoff verso un motore esterno
   * invece di chiamare l'LLM interno. La pref vive in `localStorage`.
   */
  externalLLMHandoffEnabled?: boolean;
  onToggleExternalLLMHandoff?: () => void;
  /** Reset «Pulisci tutto» — apre conferma modale e poi azzera l'output del wizard. */
  onClearAllWizardOutput?: () => void;
  /** Reset contestuale Passo 2: elimina solo conversazioni/baseline conversazioni. */
  onClearWizardConversations?: () => void;
  /** @deprecated Non più esposto in UI: la tokenizzazione è derivata dal testo canonico. */
  onClearWizardTokenization?: () => void;
  /**
   * Use case attualmente selezionato nella lista del Passo 1. Necessario per il preview JSON
   * conversazionale (`wizard.showJsonPanel === true`). Risolto dal parent leggendo l'evento
   * `onSelectionChange` del composer.
   */
  selectedUseCase?: AIAgentUseCase | null;
  /**
   * Richiesta dal pannello DX «Mostra JSON» di selezionare un altro use case (frecce ◀ ▶ del
   * mini-header). Il parent deve aggiornare la selezione master della lista SX in modo che il
   * pannello DX e la lista restino sincronizzati.
   */
  onSelectUseCaseRequest?: (useCaseId: string) => void;
  /**
   * Lista use case del catalogo — necessaria per:
   *  1. abilitare il bottone «Crea prompt conversazionale» solo quando TUTTI sono compilabili
   *  2. passare la lista a {@link ConversationalPromptDialog} che costruisce il prompt
   *  3. permettere al pannello DX «Mostra JSON» di navigare tra gli use case proiettabili
   * Default: array vuoto (il bottone resta nascosto, le frecce DX nascoste).
   */
  useCases?: readonly AIAgentUseCase[];
  /**
   * Slot per overlay confinati al pannello wizard (es. {@link ExternalLLMHandoffDialog}).
   * Il caller costruisce il nodo e lo passa qui; il root del wizard è `relative` per ancorarli
   * con `absolute inset-0`. Così il modale oscura solo il rettangolo del wizard, non l'editor.
   */
  overlay?: React.ReactNode;
}

function TutorialAsideBody(props: { stepId: UseCaseGeneratorWizardStepId }): React.ReactElement {
  const cfg = getUseCaseGeneratorWizardStepConfig(props.stepId);
  const leadParagraphs = cfg.instructionLead.split(/\n\n+/).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-xs leading-relaxed text-slate-300">
        {leadParagraphs.map((p, i) => (
          <p key={i}>{p.trim()}</p>
        ))}
      </div>
      {cfg.instructionBullets.length > 0 ? (
        <ul className="space-y-2.5 text-xs leading-relaxed text-slate-200">
          {cfg.instructionBullets.map((line) => (
            <li
              key={line}
              className="flex gap-2.5 pl-1 border-l-2 border-violet-500/45 py-0.5 text-slate-300"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/90" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {cfg.instructionPlain.trim().length > 0 ? (
        <p className="text-[11px] leading-relaxed text-slate-500 border-t border-slate-700/60 pt-3">
          {cfg.instructionPlain}
        </p>
      ) : null}
    </div>
  );
}

export function ViewSkaGenerator({
  wizard,
  leftPanel,
  onGenerateUseCaseBundle,
  generateBusy = false,
  showStepOneListToolbar = false,
  useCaseCount = 0,
  onAdvanceWizardStep,
  bundleFeedback = null,
  onDismissBundleFeedback,
  onApplyExamplePhraseStyle,
  examplePhraseStyleBusy = false,
  examplePhraseStyleBatchProgress = null,
  onCreateConversation,
  createConversationBusy = false,
  onProofreadConversationAgentTurns,
  proofreadConversationBusy = false,
  externalLLMHandoffEnabled = false,
  onToggleExternalLLMHandoff,
  onClearAllWizardOutput,
  onClearWizardConversations,
  onClearWizardTokenization,
  selectedUseCase = null,
  onSelectUseCaseRequest,
  useCases,
  overlay,
}: ViewSkaGeneratorProps) {
  const [clearScope, setClearScope] = React.useState<ClearWizardScope | null>(null);
  const clearUseCasesAnchorRef = React.useRef<HTMLButtonElement>(null);
  const clearConversationsAnchorRef = React.useRef<HTMLButtonElement>(null);
  const clearTokenizationAnchorRef = React.useRef<HTMLButtonElement>(null);
  /**
   * Apertura dialog «Crea prompt conversazionale»: stato locale (transitorio, non persiste
   * tra sessioni). La pre-condizione di apertura (tutti compilabili) è gestita prima — qui
   * solo on/off del modale.
   */
  const [conversationalPromptDialogOpen, setConversationalPromptDialogOpen] =
    React.useState(false);
  const canCreateConversationalPrompt = React.useMemo(
    () => Array.isArray(useCases) && areAllUseCasesProjectable(useCases),
    [useCases]
  );
  const handleClearConfirm = React.useCallback(() => {
    const scope = clearScope;
    setClearScope(null);
    if (scope === 'use_case_list') onClearAllWizardOutput?.();
    if (scope === 'conversations') onClearWizardConversations?.();
    if (scope === 'tokenization') onClearWizardTokenization?.();
  }, [
    clearScope,
    onClearAllWizardOutput,
    onClearWizardConversations,
    onClearWizardTokenization,
  ]);
  const handleClearCancel = React.useCallback(() => setClearScope(null), []);
  const examplePhraseStyleBusyLabel =
    examplePhraseStyleBusy &&
    examplePhraseStyleBatchProgress &&
    examplePhraseStyleBatchProgress.total > 1
      ? `Omogeneizzando… use case ${examplePhraseStyleBatchProgress.current}/${examplePhraseStyleBatchProgress.total}`
      : undefined;

  const stepCfg = getUseCaseGeneratorWizardStepConfig(wizard.currentStepId);
  const isStepOne = wizard.currentStepId === 'use_case_list';
  const isStepConversations = wizard.currentStepId === 'conversations';
  const isStepTokenization = wizard.currentStepId === 'tokenization';
  const stepOneHasUseCases = isStepOne && useCaseCount > 0;
  const showStepOneInitialTutorial = isStepOne && !stepOneHasUseCases;
  const showFooterGenerateInitial =
    isStepOne &&
    typeof onGenerateUseCaseBundle === 'function' &&
    !stepOneHasUseCases;
  /**
   * Passo 3 riusa la stessa toolbar Riga 2 del Passo 1 (`espandi/collassa` + `Mostra scenario/frase`):
   * la lista accordion del Passo 3 è gestita dallo stesso `UseCaseWizardListToolbarContext`.
   */
  const showListToolbarRow =
    (isStepOne && showStepOneListToolbar) || (isStepTokenization && useCaseCount > 0);

  /** Passo 1 con lista: tutto in {@link UseCaseListStepReviewCard} (stile incluso). */
  const unifiedUseCaseListReview = isStepOne && stepOneHasUseCases;
  /** Passo 2: review-card dedicata (istruzione + 3 pulsanti contestuali). */
  const unifiedConversationsReview = isStepConversations;
  /** Passo 3: non ha più una review-card di tokenizzazione; il pannello DX mostra il nastro JSON. */
  const unifiedTokenizationReview = false;

  /**
   * Toggle JSON nel pannello DX:
   *  - Passo 1: on-demand tramite toggle nella toolbar.
   *  - Passo 3: sempre visibile, perché è la fase di verifica/compilazione del prompt.
   */
  const canShowJsonToggle = (isStepOne || isStepTokenization) && useCaseCount > 0;
  const showJsonRightPanel =
    (isStepTokenization && useCaseCount > 0) || (canShowJsonToggle && wizard.showJsonPanel);
  const stepTheme = STEP_COLOR_THEME[wizard.currentStepId];
  const clearDialogAnchorRef =
    clearScope === 'conversations'
      ? clearConversationsAnchorRef
      : clearScope === 'tokenization'
        ? clearTokenizationAnchorRef
        : clearUseCasesAnchorRef;
  const clearDialogMessage =
    clearScope === 'conversations'
      ? 'Confermi di voler eliminare solo le conversazioni montate e le loro baseline? Use case e compilazione JSON restano derivabili.'
      : clearScope === 'tokenization'
        ? 'Confermi di voler ripulire lo stato legacy di tokenizzazione? Use case e conversazioni restano invariati.'
        : 'Confermi di voler eliminare use case, conversazioni e dati generati?';
  const clearDialogConfirmLabel =
    clearScope === 'conversations'
      ? 'Pulisci conversazioni'
      : clearScope === 'tokenization'
        ? 'Pulisci tokenizzazione'
        : 'Pulisci casi d’uso';

  const advanceStepAnchorRef = React.useRef<HTMLButtonElement>(null);

  const [rightAsideWidthPx, setRightAsideWidthPx] = React.useState(readInitialRightAsideWidth);
  const [isLgViewport, setIsLgViewport] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  const resizeActiveRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onMq = () => setIsLgViewport(mq.matches);
    mq.addEventListener('change', onMq);
    const onResize = () => {
      setRightAsideWidthPx((w) => clampRightAsideWidth(w, window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => {
      mq.removeEventListener('change', onMq);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const onAsideResizePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isLgViewport) return;
      e.preventDefault();
      resizeActiveRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isLgViewport]
  );

  const onAsideResizePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeActiveRef.current || !isLgViewport) return;
      const vw = window.innerWidth;
      const fromRight = vw - e.clientX;
      setRightAsideWidthPx(clampRightAsideWidth(fromRight, vw));
    },
    [isLgViewport]
  );

  const finishAsideResize = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeActiveRef.current) return;
    resizeActiveRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const vw = window.innerWidth;
    const fromRight = vw - e.clientX;
    const w = clampRightAsideWidth(fromRight, vw);
    setRightAsideWidthPx(w);
    try {
      sessionStorage.setItem(RIGHT_PANEL_WIDTH_STORAGE_KEY, String(w));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <>
      <WizardAdvanceDialog
        open={wizard.dialogOpen}
        message={wizard.dialogMessage}
        onConfirm={wizard.confirmAdvanceDialog}
        onCancel={wizard.cancelAdvanceDialog}
        anchorRef={advanceStepAnchorRef}
      />
      <ClearAllWizardOutputDialog
        open={clearScope !== null}
        onConfirm={handleClearConfirm}
        onCancel={handleClearCancel}
        anchorRef={clearDialogAnchorRef}
        message={clearDialogMessage}
        confirmLabel={clearDialogConfirmLabel}
      />
      <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${stepTheme.workspace}`}>
        <div className="shrink-0 border-b border-slate-700/65 bg-gradient-to-b from-slate-900/95 to-slate-950/90">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-2 py-2.5">
            <div
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2"
              role="tablist"
              aria-label="Passi generatore use case"
            >
              {USE_CASE_GENERATOR_WIZARD_STEPS.map((step, index) => {
                const active = index === wizard.stepIndex;
                const selectable = wizard.canSelectStep(index);
                const theme = STEP_COLOR_THEME[step.id];
                const clearRef =
                  step.id === 'conversations'
                    ? clearConversationsAnchorRef
                    : step.id === 'tokenization'
                      ? clearTokenizationAnchorRef
                      : clearUseCasesAnchorRef;
                const canClear =
                  step.id === 'use_case_list'
                    ? typeof onClearAllWizardOutput === 'function' && useCaseCount > 0
                    : step.id === 'conversations'
                      ? typeof onClearWizardConversations === 'function' &&
                        wizard.conversations.length > 0
                      : false;
                /**
                 * Counter inline al titolo del passo (assorbe la vecchia label «N Usecases:»
                 * / «N Conversazioni» che erano duplicate nella riga 2).
                 * `null` quando il dato non è ancora disponibile → la pill resta solo «titolo».
                 */
                const stepCountBadge =
                  step.id === 'use_case_list'
                    ? useCaseCount > 0
                      ? String(useCaseCount)
                      : null
                    : step.id === 'conversations'
                      ? wizard.conversations.length > 0
                        ? String(wizard.conversations.length)
                        : null
                      : useCaseCount > 0
                        ? String(useCaseCount)
                        : null;
                return (
                  <React.Fragment key={step.id}>
                    {active ? (
                      <div
                        className={[
                          'flex max-w-full flex-nowrap items-center gap-x-3 rounded-lg border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all',
                          STEP_PILL_MIN_HEIGHT,
                          theme.active,
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected
                          title={step.title}
                          onClick={() => wizard.selectStep(index)}
                          className="inline-flex shrink-0 items-center rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80"
                        >
                          <span className="tabular-nums opacity-90">{index + 1}.</span>
                          <span className="ml-1 leading-tight">{step.title}</span>
                          {stepCountBadge ? (
                            <span className="ml-1.5 tabular-nums opacity-75">
                              ({stepCountBadge})
                            </span>
                          ) : null}
                        </button>
                        <ActiveStepInlineControls
                          stepId={step.id}
                          wizard={wizard}
                          showListControls={showListToolbarRow}
                          canShowJsonToggle={canShowJsonToggle}
                        />
                        {canClear ? (
                          <StepClearButton
                            ref={clearRef}
                            scope={step.id}
                            expanded={clearScope === step.id}
                            onClick={() => setClearScope((prev) => (prev === step.id ? null : step.id))}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={false}
                        aria-disabled={!selectable}
                        disabled={!selectable}
                        title={
                          selectable
                            ? step.title
                            : 'Completa il passo precedente per sbloccare questo punto della pipeline.'
                        }
                        onClick={() => wizard.selectStep(index)}
                        className={[
                          'flex max-w-[180px] items-center rounded-lg border px-3 py-1.5 text-left text-[11px] font-semibold tracking-wide transition-all',
                          STEP_PILL_MIN_HEIGHT,
                          selectable
                            ? `cursor-pointer border-slate-600/80 bg-slate-900/90 text-amber-100/85 ${theme.inactiveHover}`
                            : 'cursor-not-allowed border-slate-700/60 bg-slate-950/80 text-slate-500 opacity-45 grayscale-[0.35]',
                        ].join(' ')}
                      >
                        <span className="tabular-nums text-violet-300/95">{index + 1}.</span>
                        <span className="ml-1 leading-tight">{step.title}</span>
                        {stepCountBadge ? (
                          <span className="ml-1.5 tabular-nums opacity-70">
                            ({stepCountBadge})
                          </span>
                        ) : null}
                      </button>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
              {canCreateConversationalPrompt ? (
                <button
                  type="button"
                  onClick={() => setConversationalPromptDialogOpen(true)}
                  title="Genera il prompt unico da incollare nel tuo motore esterno (ChatGPT, …): istruzioni + catalogo JSON compilato dagli use case."
                  className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/55 bg-violet-600/80 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-500"
                >
                  <FileText size={13} aria-hidden />
                  Crea prompt conversazionale
                </button>
              ) : null}
              {typeof onToggleExternalLLMHandoff === 'function' ? (
                <label
                  className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-slate-600/80 bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/80"
                  title="Quando attivo, i pulsanti AI aprono un modale per copiare il prompt verso un motore esterno (es. ChatGPT-5) e incollare la risposta JSON."
                >
                  <input
                    type="checkbox"
                    checked={externalLLMHandoffEnabled}
                    onChange={() => onToggleExternalLLMHandoff()}
                    className="h-3.5 w-3.5 accent-violet-500"
                  />
                  LLM manual handoff
                </label>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row">
          <section
            className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-slate-800 lg:border-b-0"
            aria-label="Area lavoro passo corrente"
          >
            {/*
              Flex column + overflow-hidden: senza `flex` il composer non è un flex item con altezza
              vincolata → la lista use case cresce col contenuto e non compare mai la scrollbar.
            */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{leftPanel}</div>
          </section>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona pannello destro"
            tabIndex={0}
            className="hidden w-2 shrink-0 cursor-col-resize touch-none flex-col items-stretch justify-center border-x border-slate-700/75 bg-slate-900/45 select-none hover:bg-violet-950/30 lg:flex"
            onPointerDown={onAsideResizePointerDown}
            onPointerMove={onAsideResizePointerMove}
            onPointerUp={finishAsideResize}
            onPointerCancel={finishAsideResize}
          >
            <span className="mx-auto h-12 w-1 rounded-full bg-slate-500/90" aria-hidden />
          </div>
          <aside
            className="flex w-full min-w-0 shrink-0 flex-col border-slate-800 bg-gradient-to-b from-slate-900/55 to-slate-950/90 lg:w-auto lg:max-w-[60vw] lg:min-w-[250px]"
            style={isLgViewport ? { width: rightAsideWidthPx } : undefined}
            aria-label={
              showJsonRightPanel
                ? 'Anteprima JSON conversazionale dello use case selezionato'
                : 'Tutorial e azioni del passo'
            }
          >
            {showJsonRightPanel ? (
              <ConversationalJsonRightPanel
                selectedUseCase={selectedUseCase}
                useCases={useCases ?? []}
                onSelectUseCase={onSelectUseCaseRequest}
              />
            ) : (
              <>
            {!unifiedUseCaseListReview && !unifiedConversationsReview && !unifiedTokenizationReview ? (
              <div className="shrink-0 border-b border-violet-400/35 bg-gradient-to-br from-violet-950/95 via-slate-900/95 to-slate-950 px-4 py-4 shadow-[inset_0_1px_0_rgba(167,139,250,0.12)]">
                <div className="flex items-start gap-4">
                  <span
                    className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-2xl border border-violet-400/45 bg-violet-950/90 text-violet-100 shadow-lg shadow-violet-950/50"
                    aria-hidden
                  >
                    <GraduationCap className="h-8 w-8" strokeWidth={2} />
                  </span>
                  <h2 className="min-w-0 flex-1 pt-1 text-base font-semibold leading-snug text-amber-100">
                    {stepCfg.panelHeading}
                  </h2>
                </div>
              </div>
            ) : (
              <div className="shrink-0 border-b border-violet-500/25 bg-slate-950/90 px-4 py-2.5">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-violet-400/85">
                  <GraduationCap className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                  <span>Guida rapida</span>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {unifiedUseCaseListReview ? (
                <>
                  <UseCaseListStepReviewCard
                    useCaseCount={useCaseCount}
                    panelHeading={stepCfg.panelHeading}
                    showStyleHint={Boolean(
                      wizard.currentStepId === 'use_case_list' &&
                        wizard.examplePhraseStylePlan.showStyleCta &&
                        typeof onApplyExamplePhraseStyle === 'function'
                    )}
                    styleBusy={examplePhraseStyleBusy}
                    styleBusyLabel={examplePhraseStyleBusyLabel}
                    onApplyStyle={onApplyExamplePhraseStyle}
                    bundleFeedback={bundleFeedback}
                    onDismissBundleFeedback={onDismissBundleFeedback}
                    generateBusy={generateBusy}
                    onGenerateMore={onGenerateUseCaseBundle}
                    canGenerateMore={typeof onGenerateUseCaseBundle === 'function'}
                    onAdvanceStep={onAdvanceWizardStep}
                    canAdvanceStep={typeof onAdvanceWizardStep === 'function'}
                    advanceStepAnchorRef={advanceStepAnchorRef}
                  />
                  {wizard.showNoChangesTutorial ? (
                    <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-950/35 p-2 text-xs text-amber-100">
                      <p className="leading-relaxed">{wizard.tutorialIfNoChanges}</p>
                      <button
                        type="button"
                        className="mt-2 text-[11px] text-amber-200 underline hover:text-amber-50"
                        onClick={wizard.dismissNoChangesTutorial}
                      >
                        Chiudi
                      </button>
                    </div>
                  ) : null}
                </>
              ) : unifiedConversationsReview ? (
                <>
                  <ConversationsStepReviewCard
                    panelHeading={stepCfg.panelHeading}
                    conversationsCount={wizard.conversations.length}
                    createBusy={createConversationBusy}
                    onCreateConversation={onCreateConversation}
                    showProofreadCta={wizard.conversationStylePlan.showProofreadCta}
                    proofreadBusy={proofreadConversationBusy}
                    onProofread={onProofreadConversationAgentTurns}
                    onAdvanceStep={onAdvanceWizardStep}
                    canAdvanceStep={typeof onAdvanceWizardStep === 'function'}
                    advanceStepAnchorRef={advanceStepAnchorRef}
                  />
                  {wizard.showNoChangesTutorial ? (
                    <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-950/35 p-2 text-xs text-amber-100">
                      <p className="leading-relaxed">{wizard.tutorialIfNoChanges}</p>
                      <button
                        type="button"
                        className="mt-2 text-[11px] text-amber-200 underline hover:text-amber-50"
                        onClick={wizard.dismissNoChangesTutorial}
                      >
                        Chiudi
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {bundleFeedback ? (
                    <div className="mb-3 flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-950/45 px-2.5 py-2 text-xs leading-snug text-emerald-50 shadow-[inset_0_1px_0_rgba(52,211,153,0.12)]">
                      <span className="min-w-0 flex-1">{bundleFeedback}</span>
                      {typeof onDismissBundleFeedback === 'function' ? (
                        <button
                          type="button"
                          aria-label="Chiudi messaggio"
                          className="shrink-0 rounded p-0.5 text-emerald-200/90 hover:bg-emerald-900/60 hover:text-emerald-50"
                          onClick={() => onDismissBundleFeedback()}
                        >
                          <X size={14} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {showStepOneInitialTutorial ? (
                    <TutorialAsideBody stepId="use_case_list" />
                  ) : (
                    <TutorialAsideBody stepId={wizard.currentStepId} />
                  )}
                  {wizard.showNoChangesTutorial ? (
                    <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-950/35 p-2 text-xs text-amber-100">
                      <p className="leading-relaxed">{wizard.tutorialIfNoChanges}</p>
                      <button
                        type="button"
                        className="mt-2 text-[11px] text-amber-200 underline hover:text-amber-50"
                        onClick={wizard.dismissNoChangesTutorial}
                      >
                        Chiudi
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {showFooterGenerateInitial ? (
              <div className="shrink-0 border-t border-violet-500/25 bg-slate-950/80 px-3 py-3">
                <ViewSkaGenerateButton
                  generateBusy={generateBusy}
                  onGenerateUseCaseBundle={onGenerateUseCaseBundle}
                />
              </div>
            ) : null}
              </>
            )}
          </aside>
        </div>
        <ConversationalPromptDialog
          open={conversationalPromptDialogOpen}
          useCases={useCases ?? []}
          onClose={() => setConversationalPromptDialogOpen(false)}
        />
        {overlay}
      </div>
    </>
  );
}

/**
 * Controlli inline nel pill **attivo** dello stepper. Layout v9:
 * - `use_case_list`: griglia 2×2 (espandi/collassa + scenario/messaggio) + AB + JSON +
 *   toggle «Mostra Tokens» (vedi {@link WizardShowTokensToggle}).
 * - `conversations`: cluster outcome (pills positive/negative) + «Mostra Tokens» (interno
 *   alla {@link WizardConversationsTabsControls}).
 * - `tokenization`: SOLO «Mostra Tokens». Niente 2×2: il Passo 3 non possiede più un
 *   pannello dedicato (vedi commento v8 in `AIAgentEditorDockPanels.tsx`); espandi/
 *   collassa e scenario/frasi appartengono al pill «Casi d'uso», ripeterli qui era
 *   ridondante. La compilazione prompt/JSON vive nel pannello DX ed è derivata dagli use case.
 *
 * Il conteggio totale (use case / conversazioni) è stato spostato nel label
 * del pill (es. `1. Casi d'uso (4)`), quindi qui NON è più ripetuto.
 */
function ActiveStepInlineControls({
  stepId,
  wizard,
  showListControls,
  canShowJsonToggle,
}: {
  stepId: UseCaseGeneratorWizardStepId;
  wizard: UseCaseGeneratorWizardModel;
  showListControls: boolean;
  canShowJsonToggle: boolean;
}): React.ReactElement | null {
  if (stepId === 'conversations') {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <WizardConversationsTabsControls wizard={wizard} />
      </div>
    );
  }

  if (stepId === 'use_case_list') {
    if (!showListControls) return null;
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <WizardStepOneListToolbarControls
          wizard={wizard}
          canShowJsonToggle={canShowJsonToggle}
          expandTheme="violet"
        />
      </div>
    );
  }

  if (stepId === 'tokenization') {
    if (!showListControls) return null;
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <WizardShowTokensToggle wizard={wizard} />
      </div>
    );
  }

  return null;
}

const StepClearButton = React.forwardRef<
  HTMLButtonElement,
  {
    scope: ClearWizardScope;
    expanded: boolean;
    onClick: () => void;
  }
>(function StepClearButton({ scope, expanded, onClick }, ref) {
  const title =
    scope === 'use_case_list'
      ? 'Pulisci casi d’uso e dati derivati'
      : scope === 'conversations'
        ? 'Pulisci conversazioni'
      : 'Pulisci stato legacy';
  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={title}
      title={title}
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-500/45 bg-rose-950/25 text-rose-200 transition-colors hover:border-rose-400/65 hover:bg-rose-900/45 hover:text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/80"
    >
      <Trash2 size={13} aria-hidden />
    </button>
  );
});

/**
 * Sub-pannello destro on-demand «Mostra JSON» (Passo 1): header coerente con il resto del
 * wizard + Monaco read-only ({@link ConversationalJsonPanel}).
 *
 * Estratto come componente locale per non ingrossare il blocco JSX principale di
 * {@link ViewSkaGenerator}; non è esportato perché vive solo come overlay del Passo 1.
 */
function ConversationalJsonRightPanel({
  selectedUseCase,
  useCases,
  onSelectUseCase,
}: {
  selectedUseCase: AIAgentUseCase | null;
  useCases: readonly AIAgentUseCase[];
  onSelectUseCase?: (useCaseId: string) => void;
}): React.ReactElement {
  return (
    <>
      <div className="shrink-0 border-b border-violet-500/25 bg-slate-950/90 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-violet-400/85">
          <GraduationCap className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
          <span>Anteprima JSON</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
        <ConversationalJsonPanel
          selectedUseCase={selectedUseCase}
          useCases={useCases}
          onSelectUseCase={onSelectUseCase}
        />
      </div>
    </>
  );
}

/**
 * CTA "Genera use case" del footer (prima generazione bundle): guard sul modello globale +
 * etichetta in gerundio con il modello in uso ("Creando use case (gpt-5)...").
 * Estratto come sub-componente per isolare lo stato locale del toast (single responsibility).
 */
function ViewSkaGenerateButton({
  generateBusy,
  onGenerateUseCaseBundle,
}: {
  generateBusy: boolean;
  onGenerateUseCaseBundle?: () => void | Promise<void>;
}): React.ReactElement {
  const { busyLabel, hasModel } = useAiBusyLabel();
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
    void onGenerateUseCaseBundle?.();
  };

  return (
    <>
      <button
        type="button"
        disabled={generateBusy}
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {generateBusy ? (
          <Loader2 className="animate-spin" size={18} aria-hidden />
        ) : (
          <Sparkles size={18} aria-hidden />
        )}
        {generateBusy ? busyLabel('Creando use case') : LABEL_GENERATE_USE_CASES}
        {!generateBusy ? (
          <LastAiCostBadge purpose={AI_CALL_PURPOSE.USE_CASE_BUNDLE_INITIAL} />
        ) : null}
      </button>
      {showNoModelToast ? (
        <MissingAiModelToast onDismiss={() => setShowNoModelToast(false)} />
      ) : null}
    </>
  );
}
