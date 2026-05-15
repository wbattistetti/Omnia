/**
 * ViewSkaGenerator: shell con toolbar multi-riga (stepper + Riga 2 contestuale + Riga 3 al passo 2),
 * pannello SX solo lavoro, DX tutorial + azioni del passo.
 */

import React from 'react';
import { Braces, GraduationCap, Loader2, Sparkles, Trash2, X } from 'lucide-react';
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
import { WizardStepOneListToolbarControls } from './WizardStepOneListToolbar';
import { WizardConversationsTabsControls } from './WizardConversationsToolbarRows';
import { ClearAllWizardOutputDialog } from './ClearAllWizardOutputDialog';
import { ConversationalJsonPanel } from './ConversationalJsonPanel';
import { CompletaCorrezioneCallout } from './CompletaCorrezioneCallout';
import { useUseCaseWizardListToolbarOptional } from './UseCaseWizardListToolbarContext';
import { isCompletaCorrezioneCalloutSurfaceActive } from '../useCaseSubstantialEdits';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';

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
    /**
     * Pill attivo: bordo `border-2` + ring `ring-2` per renderlo nettamente più
     * marcato dello stato hover (richiesta esplicita Img 4 mag 2026: "bordo più
     * spesso"). Lo step inattivo resta a `border` (1px) — la differenza visiva
     * fra attivo/inattivo deve essere immediata.
     */
    active:
      'border-2 border-violet-300 bg-violet-950/60 text-amber-100 shadow-[0_0_22px_rgba(139,92,246,0.38)] ring-2 ring-inset ring-violet-400/55',
    inactiveHover:
      'hover:border-violet-500/50 hover:bg-violet-100/70 dark:hover:bg-violet-950/25',
    workspace:
      'bg-gradient-to-br from-violet-50/90 via-slate-50 to-slate-100 dark:from-violet-950/12 dark:via-slate-950 dark:to-slate-950',
  },
  conversations: {
    active:
      'border-2 border-emerald-300 bg-emerald-950/55 text-emerald-50 shadow-[0_0_22px_rgba(52,211,153,0.34)] ring-2 ring-inset ring-emerald-400/55',
    inactiveHover:
      'hover:border-emerald-500/50 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/25',
    workspace:
      'bg-gradient-to-br from-emerald-50/90 via-slate-50 to-slate-100 dark:from-emerald-950/12 dark:via-slate-950 dark:to-slate-950',
  },
  tokenization: {
    /**
     * Step legacy non più visibile come pill (filtrato in render). Manteniamo lo
     * style in mappa per evitare type-error sull'`UseCaseGeneratorWizardStepId`
     * exhaustive: `STEP_COLOR_THEME[wizard.currentStepId]` è ancora valutato
     * altrove (es. workspace background dello shell), e il branch `tokenization`
     * resta raggiungibile via `wizard.toggleShowJsonPanel` interno.
     */
    active:
      'border-2 border-amber-300 bg-amber-950/45 text-amber-50 shadow-[0_0_22px_rgba(245,158,11,0.32)] ring-2 ring-inset ring-amber-400/55',
    inactiveHover:
      'hover:border-amber-500/45 hover:bg-amber-100/70 dark:hover:bg-amber-950/20',
    workspace:
      'bg-gradient-to-br from-amber-50/90 via-slate-50 to-slate-100 dark:from-amber-950/10 dark:via-slate-950 dark:to-slate-950',
  },
};

/**
 * Altezza minima della pill: i tre tab (Casi d'uso / Conversazioni / Prompt e JSON) sono
 * ora compatti (~32 px) perché i controlli contestuali (espandi, scenario, messaggio,
 * cluster outcome…) NON vivono più dentro la pill del tab attivo, ma in una **seconda
 * riga** sotto i tab (vedi `ContextualToolbarRow`). Questo libera spazio verticale e
 * rende la barra dei tab più leggibile.
 */
const STEP_PILL_MIN_HEIGHT = 'min-h-[32px]';

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
  /** Lessico progetto per anteprima JSON `variants[]` con compile semantico. */
  projectSlotLexicon?: ProjectSlotLexicon;
  /**
   * Messaggio payoff inline da mostrare sotto i 3 pulsanti di creazione conversazione
   * (Passo 2). Usato dal **gate di stile**: se l'utente clicca un pulsante senza aver
   * definito uno stile a SX, il padre passa qui il messaggio in rosso. Default `null`.
   */
  conversationsPayoffMessage?: string | null;
  /**
   * Slot compatto a destra della toolbar del passo Conversazioni. Usato per le pill stile
   * post-generazione: checkbox = stili attivi; glow = stile visualizzato nelle bubble.
   */
  conversationsToolbarSlot?: React.ReactNode;
  /** Contratto stile effettivo (preset + note) per generazione use case. */
  generationStyleContract?: string;
  onGenerationStyleContractChange?: (next: string) => void;
  generationStyleFieldDisabled?: boolean;
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
  onTokenizeUseCases,
  tokenizeUseCasesBusy = false,
  onClearAllWizardOutput,
  onClearWizardConversations,
  onClearWizardTokenization,
  selectedUseCase = null,
  onSelectUseCaseRequest,
  useCases,
  projectSlotLexicon,
  conversationsPayoffMessage = null,
  conversationsToolbarSlot = null,
  generationStyleContract = '',
  onGenerationStyleContractChange,
  generationStyleFieldDisabled = false,
}: ViewSkaGeneratorProps) {
  const [clearScope, setClearScope] = React.useState<ClearWizardScope | null>(null);
  const clearUseCasesAnchorRef = React.useRef<HTMLButtonElement>(null);
  const clearConversationsAnchorRef = React.useRef<HTMLButtonElement>(null);
  const clearTokenizationAnchorRef = React.useRef<HTMLButtonElement>(null);
  /**
   * NB: il dialog «Crea prompt conversazionale» è ora montato dal parent
   * ({@link AIAgentEditor} insieme alla tab strip Dockview): vedi
   * `AIAgentEditorDockContext` (`createConversationalPromptDialog*`).
   * Qui non c'è più state locale, e l'azione di apertura è esposta via context.
   */

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
  const listToolbarCtx = useUseCaseWizardListToolbarOptional();
  /**
   * Il callout «Completa correzione» sostituisce la review card / tutorial rapido nel DX:
   * stessa condizione di montaggio del callout (vedi {@link isCompletaCorrezioneCalloutSurfaceActive}).
   */
  const correctionReplacesUseCaseTutorial =
    unifiedUseCaseListReview &&
    listToolbarCtx !== null &&
    isCompletaCorrezioneCalloutSurfaceActive({
      pendingCorrectionsCount: listToolbarCtx.pendingCorrectionsCount,
      correctionsDismissed: listToolbarCtx.correctionsDismissed,
      correctionsBusy: listToolbarCtx.correctionsBusy,
    });
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
  const resizeActiveRef = React.useRef(false);

  /**
   * Mantiene l'aside DX entro i limiti se cambia la viewport (es. drag finestra). Il media
   * query `lg` non è più rilevante: il layout è sempre a due colonne (vedi nota nel JSX
   * sopra). Il clamp serve solo a garantire `min/max` rispetto alla larghezza viewport.
   */
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      setRightAsideWidthPx((w) => clampRightAsideWidth(w, window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const onAsideResizePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      resizeActiveRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    []
  );

  const onAsideResizePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeActiveRef.current) return;
      const vw = window.innerWidth;
      const fromRight = vw - e.clientX;
      setRightAsideWidthPx(clampRightAsideWidth(fromRight, vw));
    },
    []
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
        <div className="shrink-0 border-b border-slate-200/90 bg-gradient-to-b from-slate-50 via-slate-100 to-slate-100 dark:border-slate-700/65 dark:from-slate-900/95 dark:via-slate-950 dark:to-slate-950/90">
          {/*
            Riga 1 (single-line per il passo «Casi d'uso»): tab strip a sinistra +
            mini-toolbar contestuale a destra. Per gli altri step la mini-toolbar
            resta su una RIGA 2 separata (vedi `<ContextualToolbarRow>` sotto)
            perché i controlli sono troppo voluminosi (es. pill stile del passo
            Conversazioni). `flex-nowrap` + `overflow-x-auto` garantiscono che
            non si spezzi mai in due righe (richiesta esplicita Img 4 mag 2026).
          */}
          <div className="flex flex-nowrap items-center gap-x-2 overflow-x-auto px-2 py-2.5">
            <div
              className="flex shrink-0 items-center gap-x-2"
              role="tablist"
              aria-label="Passi generatore use case"
            >
              {USE_CASE_GENERATOR_WIZARD_STEPS
                /**
                 * `tokenization` non è più un pill cliccabile dello stepper: l'accesso al
                 * pannello JSON di destra avviene tramite l'icona inline {JS} che vive nel
                 * pill «Casi d'uso» (vedi `JsonInlineButton` qui sotto). Lo step
                 * resta nel config/wizard model perché altri pezzi di codice ancora lo
                 * referenziano (es. clear scope), ma non viene mostrato come tab.
                 */
                .filter((s) => s.id !== 'tokenization')
                .map((step) => {
                /**
                 * `index` deve essere quello reale della config completa (non quello del
                 * filtrato), perché `wizard.stepIndex` / `wizard.selectStep(i)` / `wizard.canSelectStep(i)`
                 * lavorano su indici della pipeline originale (use_case_list=0,
                 * conversations=1, tokenization=2).
                 */
                const index = USE_CASE_GENERATOR_WIZARD_STEPS.findIndex((s) => s.id === step.id);
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
                const showInlineJsonButton = step.id === 'use_case_list' && useCaseCount > 0;
                const conversationsLen = wizard.conversations.length;
                /**
                 * Testo pill: niente prefisso «1.» / «2.» (richiesta UX). «Casi d'uso» + (N)
                 * solo se N>0; «Conversazioni» sempre come «n Conversazioni» (n può essere 0).
                 */
                const displayTitle =
                  step.id === 'conversations'
                    ? `${conversationsLen} Conversazioni`
                    : step.title;
                const stepCountBadge =
                  step.id === 'use_case_list' && useCaseCount > 0 ? String(useCaseCount) : null;
                return (
                  <React.Fragment key={step.id}>
                    {active ? (
                      <div
                        className={[
                          'flex max-w-full flex-nowrap items-center gap-x-2 rounded-lg border px-3 py-1 text-[11px] font-semibold tracking-wide transition-all',
                          STEP_PILL_MIN_HEIGHT,
                          theme.active,
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected
                          title={displayTitle}
                          onClick={() => wizard.selectStep(index)}
                          className="inline-flex shrink-0 items-center rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80"
                        >
                          <span className="leading-tight">{displayTitle}</span>
                          {stepCountBadge ? (
                            <span className="ml-1.5 tabular-nums opacity-75">
                              ({stepCountBadge})
                            </span>
                          ) : null}
                        </button>
                        {showInlineJsonButton ? (
                          <JsonInlineButton
                            active={wizard.showJsonPanel}
                            busy={tokenizeUseCasesBusy}
                            onClick={() => {
                              /**
                               * Behavior:
                               *  - chiudi se aperto;
                               *  - apri + ricompila se chiuso (così il pannello mostra
                               *    sempre l'ultima proiezione canonica → JSON allineata).
                               * Errori della compilazione restano in carico al toast/log
                               * del controller (non li sopprimiamo qui).
                               */
                              if (wizard.showJsonPanel) {
                                wizard.toggleShowJsonPanel();
                                return;
                              }
                              wizard.toggleShowJsonPanel();
                              if (typeof onTokenizeUseCases === 'function') {
                                void onTokenizeUseCases();
                              }
                            }}
                          />
                        ) : null}
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
                            ? displayTitle
                            : 'Completa il passo precedente per sbloccare questo punto della pipeline.'
                        }
                        onClick={() => wizard.selectStep(index)}
                        className={[
                          'flex max-w-[180px] items-center rounded-lg border px-3 py-1 text-left text-[11px] font-semibold tracking-wide transition-all',
                          STEP_PILL_MIN_HEIGHT,
                          selectable
                            ? `cursor-pointer border-slate-300/90 bg-white/95 text-slate-800 shadow-sm dark:border-slate-600/80 dark:bg-slate-900/90 dark:text-amber-100/85 dark:shadow-none ${theme.inactiveHover}`
                            : 'cursor-not-allowed border-slate-200/90 bg-slate-100/90 text-slate-400 opacity-70 dark:border-slate-700/60 dark:bg-slate-950/80 dark:text-slate-500 dark:opacity-45 dark:grayscale-[0.35]',
                        ].join(' ')}
                      >
                        <span className="leading-tight">{displayTitle}</span>
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
            {/*
              Mini-toolbar INLINE per il passo Casi d'uso: «prolungamento» visivo
              del pill attivo (stessa palette, stesso ring inset). Vive in flusso
              flex sulla stessa riga dei tab — `flex-1 min-w-0` la fa espandere
              verso destra fino a riempire lo spazio disponibile, e il suo
              `overflow-x-auto` interno gestisce l'overflow quando la riga è
              stretta. Per gli altri step la mini-toolbar resta su una RIGA 2
              separata (vedi `<ContextualToolbarRow>` sotto).
            */}
            {isStepOne && showListToolbarRow ? (
              <div
                className={`flex min-w-0 flex-1 flex-nowrap items-center gap-x-2 overflow-x-auto rounded-md border px-2 py-1 ${THEME_TOOLBAR_BG.use_case_list}`}
                role="toolbar"
                aria-label="Controlli del passo Casi d'uso"
              >
                <WizardStepOneListToolbarControls
                  wizard={wizard}
                  canShowJsonToggle={canShowJsonToggle}
                  expandTheme="violet"
                />
              </div>
            ) : null}
          </div>
          {/*
            Riga 2 (toolbar contestuale): controlli che dipendono dal tab attivo.
            Per il passo Casi d'uso la mini-toolbar è già inline nella riga 1 sopra;
            qui restano gli altri step (Conversazioni con le pill stile, ecc.).
          */}
          {!isStepOne ? (
            <ContextualToolbarRow
              stepId={wizard.currentStepId}
              wizard={wizard}
              showListControls={showListToolbarRow}
              canShowJsonToggle={canShowJsonToggle}
              themeKey={wizard.currentStepId}
              conversationsToolbarSlot={conversationsToolbarSlot}
            />
          ) : null}
        </div>

        {/*
          Layout SX/DX SEMPRE a due colonne (flex-row) — non più condizionato a `lg:` del
          viewport. Il vincolo `min-w-[720px]` su `AIAgentEditor` garantisce che il pannello
          interno non scenda mai sotto questa soglia (sotto, scroll orizzontale esterno),
          quindi le due colonne hanno sempre lo spazio per coesistere senza che la SX (lista
          use case / bubble view) venga schiacciata a 0 dall'aside DX (Guida rapida).
          Risolve la regressione: in modalità "verticale" (pannello dock stretto) il SX
          non sparisce più.
        */}
        <div className="flex min-h-0 flex-1 flex-row gap-0">
          <section
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            aria-label="Area lavoro passo corrente"
          >
            {/*
              Flex column + overflow-hidden: senza `flex` il composer non è un flex item con altezza
              vincolata → la lista use case cresce col contenuto e non compare mai la scrollbar.
            */}
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">{leftPanel}</div>
          </section>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona pannello destro"
            tabIndex={0}
            className="flex w-2 shrink-0 cursor-col-resize touch-none flex-col items-stretch justify-center border-x border-slate-300/80 bg-slate-200/45 select-none hover:bg-violet-200/50 dark:border-slate-700/75 dark:bg-slate-900/45 dark:hover:bg-violet-950/30"
            onPointerDown={onAsideResizePointerDown}
            onPointerMove={onAsideResizePointerMove}
            onPointerUp={finishAsideResize}
            onPointerCancel={finishAsideResize}
          >
            <span className="mx-auto h-12 w-1 rounded-full bg-slate-500/90" aria-hidden />
          </div>
          <aside
            className="flex min-w-[250px] max-w-[60vw] shrink-0 flex-col border-slate-200 bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100/95 dark:border-slate-800 dark:from-slate-900/55 dark:via-slate-950 dark:to-slate-950/90"
            style={{ width: rightAsideWidthPx }}
            aria-label={
              showJsonRightPanel
                ? 'Anteprima JSON conversazionale dello use case selezionato'
                : correctionReplacesUseCaseTutorial
                  ? 'Completa correzione messaggi'
                  : 'Tutorial e azioni del passo'
            }
          >
            {showJsonRightPanel ? (
              <ConversationalJsonRightPanel
                selectedUseCase={selectedUseCase}
                useCases={useCases ?? []}
                onSelectUseCase={onSelectUseCaseRequest}
                lexicon={projectSlotLexicon}
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
            ) : correctionReplacesUseCaseTutorial ? (
              <div className="shrink-0 border-b border-violet-500/25 bg-slate-50/95 px-4 py-2.5 dark:bg-slate-950/90">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-violet-400/85">
                  <Sparkles className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                  <span>Completa correzione</span>
                </div>
              </div>
            ) : (
              <div className="shrink-0 border-b border-violet-500/25 bg-slate-50/95 px-4 py-2.5 dark:bg-slate-950/90">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-violet-400/85">
                  <GraduationCap className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                  <span>Guida rapida</span>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {unifiedUseCaseListReview ? (
                <>
                  {/*
                    Callout «Completa correzione»: quando attivo sostituisce la review card
                    tutorial nel DX (stessa logica `correctionReplacesUseCaseTutorial`).
                  */}
                  <CompletaCorrezioneCallout />
                  {correctionReplacesUseCaseTutorial ? null : (
                    <>
                      <UseCaseListStepReviewCard
                        useCaseCount={useCaseCount}
                        panelHeading={stepCfg.panelHeading}
                        /**
                         * Vecchio CTA inline «Omogeneizza messaggi» disattivato dalla
                         * v3 della propagazione stile: l'entry point è il callout
                         * {@link CompletaCorrezioneCallout} nel pannello DX «Guida rapida»,
                         * che chiama `propagate_correction_style` con coppie
                         * `(original, modified)` esplicite.
                         */
                        showStyleHint={false}
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
                        generationStyleContract={generationStyleContract}
                        onGenerationStyleContractChange={
                          onGenerationStyleContractChange ?? (() => {})
                        }
                        styleFieldDisabled={generationStyleFieldDisabled}
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
                  )}
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
                    payoffMessage={conversationsPayoffMessage}
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
              <div className="shrink-0 border-t border-violet-500/25 bg-slate-50/95 px-3 py-3 dark:bg-slate-950/80">
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
 * Il conteggio totale use case resta nel pill come `Casi d'uso (N)`; le conversazioni
 * come `n Conversazioni` (n incluso 0). Qui NON è più ripetuto.
 */
/**
 * Riga 2 dello stepper: toolbar contestuale del tab attivo, sotto la riga dei tab.
 *
 * - Sfondo coerente al colore tema del passo (`THEME_TOOLBAR_BG`), così visivamente è
 *   chiaro che la riga "appartiene" al tab acceso sopra.
 * - Border-top sottile in tinta per separarla senza creare un secondo header pesante.
 * - Quando il passo non ha controlli da mostrare (o sono nascosti), il componente
 *   ritorna `null` e la riga non viene riservata: niente spazio sprecato.
 *
 * NB: il toggle «Mostra Tokens» (icona `[x]`) e il toggle «Mostra JSON» (icona `{}`)
 * sono stati rimossi dalla toolbar contestuale: la tokenizzazione resta «sotto il
 * cofano» (visibile solo nel JSON conversazionale) e il JSON è già accessibile dal
 * pannello DX nei passi dedicati.
 */
/**
 * Tinte della mini-toolbar (riga 2): «prolungamento» visivo del pill attivo
 * sopra di essa. Tonalità un gradino più cariche delle precedenti — su
 * richiesta esplicita Img 4 mag 2026: deve essere chiaro che la mini-toolbar
 * appartiene allo step selezionato, senza essere assordante.
 *
 * Nota: la palette di `conversations` è passata da sky a emerald per allinearsi
 * al nuovo color tema dei pill (vedi `STEP_COLOR_THEME` sopra).
 */
const THEME_TOOLBAR_BG: Record<UseCaseGeneratorWizardStepId, string> = {
  use_case_list: 'border-violet-400/55 bg-violet-950/55 ring-1 ring-inset ring-violet-400/20',
  conversations: 'border-emerald-400/55 bg-emerald-950/45 ring-1 ring-inset ring-emerald-400/20',
  tokenization: 'border-amber-400/55 bg-amber-950/40 ring-1 ring-inset ring-amber-400/20',
};

function ContextualToolbarRow({
  stepId,
  wizard,
  showListControls,
  canShowJsonToggle,
  themeKey,
  conversationsToolbarSlot,
}: {
  stepId: UseCaseGeneratorWizardStepId;
  wizard: UseCaseGeneratorWizardModel;
  showListControls: boolean;
  canShowJsonToggle: boolean;
  themeKey: UseCaseGeneratorWizardStepId;
  conversationsToolbarSlot?: React.ReactNode;
}): React.ReactElement | null {
  const themeBg = THEME_TOOLBAR_BG[themeKey];

  if (stepId === 'conversations') {
    /**
     * Ordine richiesto: prima le pill stile (filtro vista + checkbox attivazione), poi un
     * piccolo separatore visivo, poi i cluster outcome con le pill numerate per le
     * conversazioni esistenti. Lo `slot` è opzionale: quando non c'è (es. nessuna
     * conversazione ancora) il blocco a sinistra resta vuoto e i cluster occupano
     * naturalmente lo spazio.
     *
     * `overflow-x-auto` + `flex-nowrap`: la riga resta single-line; se il contenuto
     * eccede la larghezza disponibile lo scroll orizzontale gestisce l'overflow
     * senza spezzare la barra in due righe (richiesta esplicita mag 2026).
     */
    return (
      <div
        className={`flex min-w-0 flex-nowrap items-center gap-x-3 overflow-x-auto border-t px-3 py-1.5 ${themeBg}`}
        role="toolbar"
        aria-label="Controlli del passo Conversazioni"
      >
        {conversationsToolbarSlot ? (
          <>
            <div className="shrink-0">{conversationsToolbarSlot}</div>
            <span aria-hidden className="h-5 w-px shrink-0 bg-emerald-400/30" />
          </>
        ) : null}
        <div className="shrink-0">
          <WizardConversationsTabsControls wizard={wizard} />
        </div>
      </div>
    );
  }

  if (stepId === 'use_case_list') {
    if (!showListControls) return null;
    return (
      <div
        className={`flex min-w-0 flex-nowrap items-center gap-x-2 overflow-x-auto border-t px-3 py-1.5 ${themeBg}`}
        role="toolbar"
        aria-label="Controlli del passo Casi d'uso"
      >
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
      <div
        className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-t px-3 py-1.5 ${themeBg}`}
        role="toolbar"
        aria-label="Controlli del passo Tokenizzazione"
      >
        {/*
          Toggle «Mostra Tokens» rimosso. Il passo tokenizzazione mostra la sua azione
          principale dal pannello DX; questa riga 2 resta vuota (niente da mostrare) e
          quindi il chiamante può scegliere di non renderizzarla — qui non rendiamo
          nulla per evitare una riga vuota visivamente confusa.
        */}
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
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-500/45 bg-rose-950/25 text-rose-200 transition-colors hover:border-rose-400/65 hover:bg-rose-900/45 hover:text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/80"
    >
      <Trash2 size={15} aria-hidden />
    </button>
  );
});

/**
 * Pulsante inline `{JS}` nel pill «Casi d'uso»: apre/chiude il pannello JSON di destra
 * (controllato da `wizard.showJsonPanel`). Quando il pannello passa da chiuso ad aperto,
 * il chiamante avvia anche la compilazione fresca degli use case in background, in modo
 * che la proiezione JSON visualizzata sia sempre allineata al testo canonico più recente.
 *
 * Sostituisce, dal mag 2026, il vecchio terzo step «Prompt e JSON» della pipeline:
 * lo stepper resta a due passi visibili (Casi d'uso, Conversazioni) e l'accesso al JSON
 * è una micro-azione contestuale al passo Casi d'uso.
 */
function JsonInlineButton({
  active,
  busy,
  onClick,
}: {
  active: boolean;
  busy: boolean;
  onClick: () => void;
}): React.ReactElement {
  const title = active
    ? 'Chiudi il pannello JSON'
    : 'Apre il pannello per verificare i Json (compila gli use case prima di mostrarli)';
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={busy}
      className={[
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80',
        active
          ? 'border-violet-400/85 bg-violet-900/55 text-violet-50 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]'
          : 'border-violet-500/40 bg-violet-950/25 text-violet-200 hover:border-violet-400/65 hover:bg-violet-900/40 hover:text-violet-100',
        busy ? 'cursor-wait opacity-70' : '',
      ].join(' ')}
    >
      {busy ? (
        <Loader2 size={15} aria-hidden className="animate-spin" />
      ) : (
        <Braces size={15} aria-hidden />
      )}
    </button>
  );
}

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
  lexicon,
}: {
  selectedUseCase: AIAgentUseCase | null;
  useCases: readonly AIAgentUseCase[];
  onSelectUseCase?: (useCaseId: string) => void;
  lexicon?: ProjectSlotLexicon;
}): React.ReactElement {
  return (
    <>
      <div className="shrink-0 border-b border-violet-500/25 bg-slate-50/95 px-4 py-2.5 dark:bg-slate-950/90">
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
          lexicon={lexicon}
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
