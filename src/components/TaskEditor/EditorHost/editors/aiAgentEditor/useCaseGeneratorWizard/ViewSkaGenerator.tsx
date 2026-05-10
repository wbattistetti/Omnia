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
import { WizardAdvanceDialog } from './WizardAdvanceDialog';
import { useUseCaseWizardListToolbarOptional } from './UseCaseWizardListToolbarContext';
import { useOptionalAIAgentEditorDock } from '../AIAgentEditorDockContext';

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

/** Passo 1 dopo almeno uno use case: istruzioni di revisione + CTA secondarie. */
function StepOneReviewAside(props: { count: number }): React.ReactElement {
  const n = Math.max(0, props.count);
  const bullets = [
    'correggere le etichette che ho assegnato',
    'rivedere gli scenari descritti',
    'aggiungere manualmente nuovi casi d’uso',
    'eliminare quelli che non ti sembrano appropriati',
  ];
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-xs leading-relaxed text-slate-300">
        <p>Ho creato {n} use case, ti chiedo di verificarli.</p>
        <p className="font-medium text-slate-200">Puoi:</p>
      </div>
      <ul className="space-y-2.5 text-xs leading-relaxed text-slate-200">
        {bullets.map((line) => (
          <li
            key={line}
            className="flex gap-2.5 pl-1 border-l-2 border-violet-500/45 py-0.5 text-slate-300"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/90" aria-hidden />
            <span>. {line}</span>
          </li>
        ))}
      </ul>
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
}: ViewSkaGeneratorProps) {
  const stepCount = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length;
  const stepCfg = getUseCaseGeneratorWizardStepConfig(wizard.currentStepId);
  const stepOneHasUseCases = wizard.stepIndex === 0 && useCaseCount > 0;
  const showStepOneInitialTutorial =
    wizard.stepIndex === 0 && wizard.currentStepId === 'use_case_list' && !stepOneHasUseCases;
  const showStepOneReviewAside =
    wizard.stepIndex === 0 && wizard.currentStepId === 'use_case_list' && stepOneHasUseCases;
  const showFooterGenerateInitial =
    wizard.stepIndex === 0 &&
    typeof onGenerateUseCaseBundle === 'function' &&
    !stepOneHasUseCases;
  const showFooterStepOneReview =
    wizard.stepIndex === 0 &&
    stepOneHasUseCases &&
    (typeof onGenerateUseCaseBundle === 'function' || typeof onAdvanceWizardStep === 'function');
  const showListToolbarRow =
    wizard.stepIndex === 0 && showStepOneListToolbar;

  const advanceStepAnchorRef = React.useRef<HTMLButtonElement>(null);

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
            className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-slate-800 lg:border-b-0 lg:border-r lg:border-slate-800"
            aria-label="Area lavoro passo corrente"
          >
            <div className="min-h-0 flex-1 overflow-hidden">{leftPanel}</div>
          </section>
          <aside
            className="flex w-full shrink-0 flex-col border-slate-800 bg-gradient-to-b from-slate-900/55 to-slate-950/90 lg:w-[min(44%,420px)] lg:border-l"
            aria-label="Tutorial e azioni del passo"
          >
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

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
              {showStepOneReviewAside ? (
                <StepOneReviewAside count={useCaseCount} />
              ) : showStepOneInitialTutorial ? (
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
                  {generateBusy ? 'Generazione scenari…' : LABEL_GENERATE_USE_CASES}
                </button>
              </div>
            ) : null}
            {showFooterStepOneReview ? (
              <div className="shrink-0 space-y-3 border-t border-violet-500/25 bg-slate-950/80 px-3 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-slate-400">
                  <span>Se vuoi posso creare altri use case</span>
                  <button
                    type="button"
                    disabled={generateBusy || typeof onGenerateUseCaseBundle !== 'function'}
                    onClick={() => void onGenerateUseCaseBundle?.()}
                    className="rounded-md border border-violet-500/55 bg-violet-700/35 px-3 py-1.5 text-xs font-medium text-violet-50 hover:bg-violet-600/40 disabled:opacity-40"
                  >
                    {generateBusy ? (
                      <>
                        <Loader2 className="inline animate-spin mr-1" size={14} aria-hidden />
                        Generazione…
                      </>
                    ) : (
                      'sì, creane altri'
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-slate-400">
                  <span>oppure possiamo</span>
                  <button
                    ref={advanceStepAnchorRef}
                    type="button"
                    disabled={!onAdvanceWizardStep}
                    onClick={() => onAdvanceWizardStep?.()}
                    className="rounded-md border border-slate-600 bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-750 disabled:opacity-40"
                  >
                    andare al passo successivo
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
