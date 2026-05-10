/**
 * ViewSkaGenerator: shell con toolbar multiriga (stepper + barra lista use case al passo 1), pannello SX solo lavoro, DX tutorial + azioni.
 */

import React from 'react';
import { ChevronRight, GraduationCap, Loader2, Sparkles, X } from 'lucide-react';
import { getUseCaseGeneratorWizardStepConfig, USE_CASE_GENERATOR_WIZARD_STEPS } from '@domain/useCaseGeneratorWizard/config';
import { USE_CASE_GENERATOR_WIZARD_STEP_ORDER } from '@domain/useCaseGeneratorWizard/registry';
import type { UseCaseGeneratorWizardStepId } from '@domain/useCaseGeneratorWizard/types';
import { LABEL_GENERATE_USE_CASES } from '../constants';
import type { UseCaseGeneratorWizardModel } from './useUseCaseGeneratorWizard';
import { ExamplePhraseStyleCallout } from './ExamplePhraseStyleCallout';
import { UseCaseListStepReviewCard } from './UseCaseListStepReviewCard';
import { WizardAdvanceDialog } from './WizardAdvanceDialog';
import { useUseCaseWizardListToolbarOptional } from './UseCaseWizardListToolbarContext';
import { useOptionalAIAgentEditorDock } from '../AIAgentEditorDockContext';

const RIGHT_PANEL_WIDTH_STORAGE_KEY = 'omnia.aiAgent.useCaseWizard.rightPanelWidthPx';
const RIGHT_PANEL_MIN_PX = 250;
const RIGHT_PANEL_MAX_VIEWPORT_FRAC = 0.6;

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
  /** Passo 2: applica stile dalle frasi modificate. */
  onApplyExamplePhraseStyle?: () => void | Promise<void>;
  examplePhraseStyleBusy?: boolean;
}

/** Toolbar seconda riga: conteggio + Usecases / Mostra + pulsanti toggle (context dal Provider). */
function WizardStepOneListToolbar({
  visible,
  useCaseCount = 0,
}: {
  visible: boolean;
  /** Mostrato davanti a «Usecases:» (passo 1 wizard). */
  useCaseCount?: number;
}): React.ReactElement | null {
  const ctx = useUseCaseWizardListToolbarOptional();
  const dock = useOptionalAIAgentEditorDock();
  if (!visible || !ctx) return null;
  const {
    bulkFold,
    showScenario,
    showMessage,
    toggleScenario,
    toggleMessage,
    triggerExpandAll,
    triggerCollapseAll,
  } = ctx;

  const btn =
    'px-2.5 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80';
  const on = 'bg-violet-600/40 text-amber-100';
  const off = 'bg-slate-900/90 text-slate-400 hover:bg-slate-800 hover:text-slate-200';

  return (
    <div
      className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-violet-500/20 bg-slate-950/50 px-3 py-2"
      role="toolbar"
      aria-label="Controlli lista use case"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-slate-500">
          <span className="tabular-nums font-semibold text-amber-100/90">{useCaseCount}</span>{' '}
          Usecases:
        </span>
        <div className="inline-flex items-center overflow-hidden rounded-md border border-slate-600/90 bg-slate-900/80">
          <button
            type="button"
            aria-pressed={bulkFold === 'expanded'}
            className={`${btn} ${bulkFold === 'expanded' ? on : off}`}
            onClick={triggerExpandAll}
          >
            espandi
          </button>
          <span className="select-none px-0.5 text-slate-600" aria-hidden>
            |
          </span>
          <button
            type="button"
            aria-pressed={bulkFold === 'collapsed'}
            className={`${btn} ${bulkFold === 'collapsed' ? on : off}`}
            onClick={triggerCollapseAll}
          >
            collassa
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-slate-500">Mostra:</span>
        <div className="inline-flex items-center overflow-hidden rounded-md border border-slate-600/90 bg-slate-900/80">
          <button
            type="button"
            aria-pressed={showScenario}
            className={`${btn} ${showScenario ? on : off}`}
            onClick={toggleScenario}
          >
            scenario
          </button>
          <span className="select-none px-0.5 text-slate-600" aria-hidden>
            |
          </span>
          <button
            type="button"
            aria-pressed={showMessage}
            className={`${btn} ${showMessage ? on : off}`}
            onClick={toggleMessage}
          >
            messaggi
          </button>
        </div>
      </div>
      {dock ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-slate-500">Ordine:</span>
          <button
            type="button"
            aria-pressed={dock.useCaseSiblingSortMode === 'alphabetical'}
            title={
              dock.useCaseSiblingSortMode === 'alphabetical'
                ? 'Ordine alfabetico tra fratelli — clic per ordine dialogo (come generato/unione)'
                : 'Ordine dialogo (lista/API) — clic per alfabetico tra fratelli'
            }
            className={`${btn} ${dock.useCaseSiblingSortMode === 'alphabetical' ? on : off}`}
            onClick={() =>
              dock.setUseCaseSiblingSortMode(
                dock.useCaseSiblingSortMode === 'alphabetical' ? 'logical' : 'alphabetical'
              )
            }
          >
            AB
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StepConnector(): React.ReactElement {
  return (
    <div
      className="flex shrink-0 items-center gap-0 px-0.5 text-violet-400/55"
      aria-hidden
    >
      <span className="h-[2px] w-5 bg-gradient-to-r from-violet-600/75 via-violet-500/45 to-transparent rounded-full" />
      <ChevronRight strokeWidth={2.5} className="h-4 w-4 -ml-0.5 text-violet-400/90" />
    </div>
  );
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
}: ViewSkaGeneratorProps) {
  const stepCount = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length;
  const stepCfg = getUseCaseGeneratorWizardStepConfig(wizard.currentStepId);
  const stepOneHasUseCases = wizard.stepIndex === 0 && useCaseCount > 0;
  const showStepOneInitialTutorial =
    wizard.stepIndex === 0 && wizard.currentStepId === 'use_case_list' && !stepOneHasUseCases;
  const showFooterGenerateInitial =
    wizard.stepIndex === 0 &&
    typeof onGenerateUseCaseBundle === 'function' &&
    !stepOneHasUseCases;
  const showListToolbarRow =
    wizard.stepIndex === 0 && showStepOneListToolbar;

  const showExamplePhraseStyleCallout =
    (wizard.currentStepId === 'example_phrases' || wizard.currentStepId === 'use_case_list') &&
    wizard.examplePhraseStylePlan.showStyleCta;

  /** Passo 1 con lista: tutto in {@link UseCaseListStepReviewCard} (stile incluso). */
  const unifiedUseCaseListReview =
    wizard.stepIndex === 0 && wizard.currentStepId === 'use_case_list' && stepOneHasUseCases;

  const showExamplePhraseStyleCalloutStandalone =
    showExamplePhraseStyleCallout &&
    wizard.currentStepId === 'example_phrases' &&
    typeof onApplyExamplePhraseStyle === 'function';

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
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950/90">
        <div className="shrink-0 border-b border-violet-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/90">
          <div className="flex flex-wrap items-center gap-y-2 px-2 py-2.5">
            <div
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-0 gap-y-2"
              role="tablist"
              aria-label="Passi generatore use case"
            >
              {USE_CASE_GENERATOR_WIZARD_STEPS.map((step, index) => {
                const active = index === wizard.stepIndex;
                const selectable = wizard.canSelectStep(index);
                return (
                  <React.Fragment key={step.id}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-disabled={!selectable}
                      disabled={!selectable}
                      title={
                        selectable
                          ? step.title
                          : 'Completa il passo precedente per sbloccare questo punto della pipeline.'
                      }
                      onClick={() => wizard.selectStep(index)}
                      className={[
                        'rounded-lg px-3 py-2 text-left text-[11px] font-semibold tracking-wide transition-all min-h-[40px] flex items-center max-w-[160px] border',
                        selectable
                          ? 'cursor-pointer'
                          : 'cursor-not-allowed opacity-45 grayscale-[0.35]',
                        active
                          ? 'border-violet-400/70 bg-violet-600/35 text-amber-100 shadow-[0_0_20px_rgba(139,92,246,0.25)]'
                          : selectable
                            ? 'border-slate-600/80 bg-slate-900/90 text-amber-100/85 hover:border-violet-500/50 hover:bg-slate-800/90'
                            : 'border-slate-700/60 bg-slate-950/80 text-slate-500',
                      ].join(' ')}
                    >
                      <span className="tabular-nums text-violet-300/95">{index + 1}.</span>
                      <span className="ml-1 leading-tight">{step.title}</span>
                    </button>
                    {index < stepCount - 1 ? <StepConnector /> : null}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <WizardStepOneListToolbar visible={showListToolbarRow} useCaseCount={useCaseCount} />
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
            aria-label="Tutorial e azioni del passo"
          >
            {!unifiedUseCaseListReview ? (
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
                  <ExamplePhraseStyleCallout
                    visible={Boolean(showExamplePhraseStyleCalloutStandalone)}
                    busy={examplePhraseStyleBusy}
                    onApply={() => void onApplyExamplePhraseStyle?.()}
                  />
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
                <button
                  type="button"
                  disabled={generateBusy}
                  onClick={() => void onGenerateUseCaseBundle?.()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {generateBusy ? (
                    <Loader2 className="animate-spin" size={18} aria-hidden />
                  ) : (
                    <Sparkles size={18} aria-hidden />
                  )}
                  {generateBusy ? 'Generando…' : LABEL_GENERATE_USE_CASES}
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
