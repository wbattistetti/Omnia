/**
 * AI Agent Construction Wizard — Shell del Task Editor AI Agent.
 *
 * Post-unificazione layout: è l'**unico** shell del Task Editor AI Agent (il vecchio
 * `AIAgentEditorDockShell` è stato rimosso). Tutti i task — nuovi e legacy — sono
 * renderizzati qui.
 *
 * Filosofia di design:
 *   - Riusa as-is i pannelli esistenti (`EditorUnifiedDescriptionPanel`,
 *     `EditorBackendsPanel`, `EditorUseCasesPanel`, `EditorDatiPanel`,
 *     `EditorIaRuntimePanel`). NIENTE riscrittura: il wizard è solo la "chrome"
 *     che li mostra uno alla volta, sequenziali.
 *   - Renderizza un'header tutorial breve sopra ciascuno step (titolo + 1 riga di guida).
 *
 * Niente Dockview qui: lo shell wizard è un layout fisso, lineare.
 */

import React from 'react';
import {
  type AgentWizardStepIndex,
  AGENT_WIZARD_FIRST_STEP_INDEX,
} from '@domain/aiAgentConstruction/agentConstructionPhase';
import { AGENT_WIZARD_STEPS_META, getAgentWizardStepMeta } from './agentWizardStepsMeta';
import { AIAgentConstructionStepper } from './AIAgentConstructionStepper';
import {
  EditorDatiPanel,
  EditorUnifiedDescriptionPanel,
  EditorUseCasesPanel,
} from '../AIAgentEditorDockPanels';
import { EditorBackendsPanel } from '../EditorBackendsPanel';
import { EditorIaRuntimePanel } from '../EditorIaRuntimePanel';
import { EditorTaskCostsPanel } from '../EditorTaskCostsPanel';

export interface AIAgentConstructionWizardShellProps {
  readonly currentStep: AgentWizardStepIndex;
  readonly completion: readonly boolean[];
  readonly onSelectStep: (index: AgentWizardStepIndex) => void;
  /** Vedi `AIAgentConstructionStepperProps.glowStepIndex`. Forwarded as-is allo Stepper. */
  readonly glowStepIndex?: AgentWizardStepIndex | null;
  /**
   * Azione (es. «Create Agent» / «Add backend») subito dopo il titolo step («Passo X/5 …» +
   * titolo), sulla stessa riga (con wrap su viewport stretti). Il parent decide quando
   * fornirla; se `null` o `undefined`, non viene renderizzata.
   */
  readonly stepHeaderAction?: React.ReactNode;
  /**
   * Vista "Costi" attiva: pulsante extra dello stepper, separato dai 5 step ufficiali.
   * Quando true, sostituisce il body con `EditorTaskCostsPanel` filtrato per `taskId`. La
   * vista non gating, niente checkmark, sempre cliccabile (vedi {@link AIAgentConstructionStepper}).
   */
  readonly costsActive?: boolean;
  /** Callback per attivare la vista "Costi" (cliccando il pulsante separato dello stepper). */
  readonly onSelectCosts?: () => void;
  readonly interfaceActive?: boolean;
  readonly onToggleInterface?: () => void;
  readonly errorHandlingActive?: boolean;
  readonly onToggleErrorHandling?: () => void;
  /** Identit\u00e0 del task corrente: necessari per filtrare il report. Solo per `costsActive=true`. */
  readonly taskId?: string;
  readonly taskLabel?: string;
  /**
   * Slot opzionale forwardato come `deploySlot` allo {@link AIAgentConstructionStepper}: il
   * parent decide *se* fornirlo (tipicamente solo a wizard completato). Quando assente, lo
   * stepper non riserva spazio. Tenuto qui come prop pass-through per mantenere lo shell
   * agnostico rispetto al contenuto (il dropdown «Deploy» vive lato parent).
   */
  readonly deploySlot?: React.ReactNode;
  /**
   * Quando `true` il gating "step precedenti devono essere ✅" viene bypassato e tutti gli
   * step risultano cliccabili. Usato per i task legacy (`hasAgentGeneration === true`) che
   * pre-esistevano prima del wizard e potrebbero non avere tutti i criteri di completamento
   * soddisfatti, ma vanno comunque navigabili liberamente: il flusso guidato vale solo per
   * i task vergini.
   */
  readonly bypassGating?: boolean;
}

/**
 * Mappa indice step → renderer dello step (factory `() => ReactElement`).
 *
 * Ordine ufficiale post-riordino:
 *   0 Task → 1 Prompts → 2 Backend → 3 Dati → 4 Voce
 *
 * Usiamo factory functions e non `ComponentType` perché alcuni pannelli
 * (`EditorBackendsPanel`, `EditorIaRuntimePanel`) hanno firma `IDockviewPanelProps`
 * imposta dal contratto Dockview ma ne ignorano i props (`void _props`). In modalità
 * wizard NON c'\u00e8 Dockview: li invochiamo senza props con un cast esplicito a
 * `unknown` come "props vuoti", documentato qui come scelta consapevole.
 *
 * I pannelli "puri" (senza props Dockview) restano invocati direttamente.
 */
const STEP_RENDERERS: ReadonlyArray<() => React.ReactElement> = [
  () => <EditorUnifiedDescriptionPanel />,
  () => <EditorUseCasesPanel />,
  () => <EditorBackendsPanel {...({} as unknown as React.ComponentProps<typeof EditorBackendsPanel>)} />,
  () => <EditorDatiPanel />,
  () => <EditorIaRuntimePanel {...({} as unknown as React.ComponentProps<typeof EditorIaRuntimePanel>)} />,
];

export function AIAgentConstructionWizardShell({
  currentStep,
  completion,
  onSelectStep,
  glowStepIndex = null,
  stepHeaderAction = null,
  costsActive = false,
  onSelectCosts,
  interfaceActive = false,
  onToggleInterface,
  errorHandlingActive = false,
  onToggleErrorHandling,
  taskId,
  taskLabel,
  deploySlot = null,
  bypassGating = false,
}: AIAgentConstructionWizardShellProps): React.ReactElement {
  const safeStep: AgentWizardStepIndex =
    STEP_RENDERERS[currentStep] !== undefined ? currentStep : AGENT_WIZARD_FIRST_STEP_INDEX;
  const meta = getAgentWizardStepMeta(safeStep);
  const renderStepBody = STEP_RENDERERS[safeStep];
  const stepTitle =
    errorHandlingActive && safeStep === 1
      ? 'Error Handling and others'
      : meta.title;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <AIAgentConstructionStepper
        currentStep={safeStep}
        completion={completion}
        onSelectStep={onSelectStep}
        glowStepIndex={glowStepIndex}
        costsActive={costsActive}
        onSelectCosts={onSelectCosts}
        interfaceActive={interfaceActive}
        onToggleInterface={onToggleInterface}
        errorHandlingActive={errorHandlingActive}
        onToggleErrorHandling={onToggleErrorHandling}
        deploySlot={deploySlot}
        bypassGating={bypassGating}
      />
      {costsActive ? (
        /*
         * Vista "Costi" del task: sostituisce intero header+body. Il pannello ha gi\u00e0 il proprio
         * header (icona $ + nome task + descrizione) e footer (cambio EUR), quindi non serve
         * la chrome del wizard.
         */
        <main className="flex-1 min-h-0 overflow-hidden">
          {typeof taskId === 'string' && taskId ? (
            <EditorTaskCostsPanel taskId={taskId} taskLabel={taskLabel || ''} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-sm text-slate-400">
              Task non identificato: impossibile filtrare i costi.
            </div>
          )}
        </main>
      ) : (
        <>
          <header className="border-b border-slate-800 bg-slate-900/40 px-5 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3">
              <span className="shrink-0 text-sm font-semibold uppercase tracking-wide text-violet-300">
                Passo {meta.displayNumber}/{AGENT_WIZARD_STEPS_META.length}
              </span>
              <h2 className="min-w-0 text-base font-semibold text-slate-100">{stepTitle}</h2>
              {stepHeaderAction ? (
                <div className="flex shrink-0 items-center">{stepHeaderAction}</div>
              ) : null}
            </div>
            {/**
             * Tutorial breve sotto al titolo. Per gli step in cui il pannello sottostante
             * fornisce gi\u00e0 una guida esaustiva (es. step Task con il placeholder dettagliato
             * della textarea) il `meta.tutorial` \u00e8 una stringa vuota e quindi la `<p>` non
             * viene resa: evita duplicazione del testo guida.
             */}
            {meta.tutorial.trim().length > 0 ? (
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
                {meta.tutorial}
              </p>
            ) : null}
          </header>
          <main className="flex-1 min-h-0 overflow-hidden">{renderStepBody()}</main>
        </>
      )}
    </div>
  );
}
