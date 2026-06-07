/**
 * AI Agent Construction Wizard — Stepper di alto livello (cinque passi + Costi).
 *
 * Render visuale puro (no fetch, no side effects). Riceve in input:
 *   - `currentStep`     indice 0..4 dello step attivo
 *   - `completion`      array di 5 booleani (output di `evaluateAgentWizardCompletion`)
 *   - `onSelectStep`    callback di navigazione (chiamato solo per step abilitati)
 *
 * Regola di navigazione (gating soft sul bottone, gating reale sul callback):
 *   - Step considerato «abilitato» se: (a) completato OR (b) tutti i precedenti sono ✅.
 *   - Cliccare uno step abilitato chiama `onSelectStep`.
 *   - Tentare di cliccare uno step bloccato non chiama nulla (pulsante `disabled`).
 *
 * Stato visivo:
 *   - 🔒 disabilitato → grigio, cursor not-allowed
 *   - Attivo (selezionato) → highlight verde (stessa famiglia cromatica degli altri step)
 *   - ✅ completato → bordo/tonalità verde + check nel badge circolare
 *   - Abilitato ma incompleto → numero nel badge circolare + «?» discreto a destra dell’etichetta
 *
 * Render compatto: solo bottoni step, senza caption/progress bar duplicata.
 */

import React from 'react';
import { BookOpen, Check, DollarSign, Lock, Unplug, Activity } from 'lucide-react';
import {
  AGENT_WIZARD_STEP_COUNT,
  type AgentWizardStepIndex,
} from '@domain/aiAgentConstruction/agentConstructionPhase';
import { AGENT_WIZARD_STEPS_META } from './agentWizardStepsMeta';
import { tutorIdProps, UI_IDS, wizardStepUiId } from '../activeTutor/uiIds';

export interface AIAgentConstructionStepperProps {
  readonly currentStep: AgentWizardStepIndex;
  readonly completion: readonly boolean[];
  readonly onSelectStep: (index: AgentWizardStepIndex) => void;
  /**
   * Quando valorizzato, il pulsante dello step indicato riceve un effetto «glow» (anello verde).
   * Usato per richiamare l'attenzione sul primo step subito dopo l'uscita dalla Tutor di
   * benvenuto (transizione di sessione, ~4s). `null` = nessuno step in glow.
   */
  readonly glowStepIndex?: AgentWizardStepIndex | null;
  /**
   * Vista "Costi" attiva: non \u00e8 uno step di costruzione, \u00e8 un visualizzatore del report
   * filtrato per il task corrente. Sempre cliccabile, non gating, niente checkmark — separato
   * visivamente dai 5 step ufficiali con un divider verticale.
   */
  readonly costsActive?: boolean;
  /** Callback di selezione della vista "Costi". Se omesso, il pulsante non viene reso. */
  readonly onSelectCosts?: () => void;
  /**
   * Vista guardalog webhook ConvAI (ElevenLabs → gateway → backend). Separata dagli step ufficiali.
   */
  readonly webhookLogActive?: boolean;
  readonly onSelectWebhookLog?: () => void;
  /**
   * Pannello Interface agente (INPUT/OUTPUT) aperto sul passo Backend. Separato dagli step
   * ufficiali, tra «Voce» e «Costi di design».
   */
  readonly interfaceActive?: boolean;
  /** Toggle pannello Interface sul passo Backend (step 2). */
  readonly onToggleInterface?: () => void;
  /**
   * Slot opzionale renderizzato all'estrema destra dello stepper, dopo il pulsante "Costi".
   * Tipicamente contiene il dropdown «Deploy»: il parent decide quando mostrarlo (es. solo
   * a wizard completato) per non distrarre durante la costruzione iniziale. Quando `null`
   * o `undefined`, lo spazio non viene riservato.
   */
  readonly deploySlot?: React.ReactNode;
  /** Pulsante Test agente (deploy + debugger) — tipicamente subito prima di {@link deploySlot}. */
  readonly testSlot?: React.ReactNode;
  /** Menu «Pubblica for review» — tipicamente a sinistra di {@link deploySlot}. */
  readonly reviewPublishSlot?: React.ReactNode;
  /**
   * Quando `true`, tutti gli step risultano cliccabili indipendentemente dallo stato di
   * completamento dei precedenti. Usato per i task legacy (`hasAgentGeneration === true`):
   * il flusso guidato vale solo per i task vergini, i veterani hanno libero accesso a
   * qualunque step (anche quelli con criteri di completamento non soddisfatti).
   * Lo stato visivo `isComplete` resta basato sul `completion[]` reale.
   */
  readonly bypassGating?: boolean;
}

/**
 * Calcola, per ogni step, se è cliccabile dall'utente. Logica:
 * - Lo step 0 è sempre cliccabile.
 * - Step `i > 0` è cliccabile se TUTTI gli step `0..i-1` sono ✅.
 * - Lo step già completato resta sempre cliccabile (ritorno indietro per editing).
 */
function computeStepEnabled(
  completion: readonly boolean[]
): readonly boolean[] {
  const out: boolean[] = new Array(AGENT_WIZARD_STEP_COUNT).fill(false);
  let allPreviousDone = true;
  for (let i = 0; i < AGENT_WIZARD_STEP_COUNT; i++) {
    out[i] = allPreviousDone || completion[i];
    if (!completion[i]) allPreviousDone = false;
  }
  return out;
}

export function AIAgentConstructionStepper({
  currentStep,
  completion,
  onSelectStep,
  glowStepIndex = null,
  costsActive = false,
  onSelectCosts,
  webhookLogActive = false,
  onSelectWebhookLog,
  interfaceActive = false,
  onToggleInterface,
  deploySlot = null,
  testSlot = null,
  reviewPublishSlot = null,
  bypassGating = false,
}: AIAgentConstructionStepperProps): React.ReactElement {
  /**
   * Per i veterani (`bypassGating=true`) tutti gli step sono cliccabili senza vincolo di
   * ordine: il flusso guidato vale solo per i task vergini. Per i task nuovi
   * (`bypassGating=false`) si applica la regola "step `i` cliccabile solo se tutti i `0..i-1`
   * sono ✅" (vedi `computeStepEnabled`). In entrambi i casi lo stato visivo `isComplete`
   * resta basato su `completion[]` reale.
   */
  const enabled = React.useMemo(
    () =>
      bypassGating
        ? (new Array(AGENT_WIZARD_STEP_COUNT).fill(true) as readonly boolean[])
        : computeStepEnabled(completion),
    [bypassGating, completion]
  );

  return (
    <nav
      aria-label="Passi di costruzione dell'agente"
      className="border-b border-slate-800 bg-slate-950/80 px-4 py-2"
    >
      <ol className="flex flex-wrap items-center gap-2">
        {/*
          NOTA: gli step + il bottone "Costi" sono allineati a sinistra (flex-wrap), mentre
          il `deploySlot` viene spinto a destra dal `ml-auto` sul suo `<li>`. In layout su
          una sola riga vedremo `[Step1] [Step2] ... [Costi] ............................. [Deploy]`.
          Su layout stretto che va a capo, il deploy resta allineato a destra dell'ULTIMA riga.
        */}
        {AGENT_WIZARD_STEPS_META.map((meta) => {
          const isBackendStep = meta.index === 2;
          const isCurrent = !costsActive && !webhookLogActive && meta.index === currentStep;
          const isComplete = completion[meta.index] === true;
          const isEnabled = enabled[meta.index] === true;
          const Icon = meta.icon;

          const isGlow = glowStepIndex === meta.index;
          const stateClass = isCurrent
            ? 'bg-emerald-900/85 text-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-400/35'
            : isComplete
              ? 'bg-slate-800 text-emerald-100 border-emerald-700/70 hover:bg-slate-700'
              : isEnabled
                ? 'bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700'
                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed';
          const glowClass = isGlow
            ? 'animate-pulse ring-4 ring-emerald-400/55 shadow-[0_0_20px_rgba(52,211,153,0.45)]'
            : '';

          const showPendingLabelMark = isEnabled && !isComplete;

          return (
            <React.Fragment key={meta.index}>
              <li>
                <button
                  type="button"
                  disabled={!isEnabled}
                  aria-current={isCurrent ? 'step' : undefined}
                  {...tutorIdProps(wizardStepUiId(meta.index))}
                  aria-label={`Passo ${meta.displayNumber}: ${meta.title}${
                    isComplete
                      ? ' (completato)'
                      : isEnabled
                        ? ' (da completare)'
                        : ' (bloccato)'
                  }`}
                  onClick={() => {
                    if (isEnabled) onSelectStep(meta.index);
                  }}
                  className={`flex h-10 min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${stateClass} ${glowClass}`}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/25 text-xs font-semibold tabular-nums"
                    aria-hidden
                  >
                    {isComplete ? (
                      <Check size={14} className="text-emerald-300" strokeWidth={2.5} />
                    ) : !isEnabled ? (
                      <Lock size={13} className="text-slate-500" strokeWidth={2} />
                    ) : (
                      meta.displayNumber
                    )}
                  </span>
                  <Icon size={15} aria-hidden className="shrink-0 opacity-85" strokeWidth={2} />
                  <span className="inline-flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap text-sm font-medium leading-none">
                    <span>{meta.label}</span>
                    {showPendingLabelMark ? (
                      <span
                        className="inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded bg-amber-400/16 px-0.5 text-[10px] font-bold text-amber-300/90"
                        aria-hidden
                        title="Passo da completare"
                      >
                        ?
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            </React.Fragment>
          );
        })}
        {onToggleInterface ? (
          <>
            <li
              aria-hidden
              className="mx-2 hidden h-10 w-px shrink-0 self-center bg-slate-700 sm:block"
            />
            <li>
              <button
                type="button"
                {...tutorIdProps(UI_IDS.interfaceToggleButton)}
                aria-pressed={interfaceActive}
                aria-label="Interfaccia agente: parametri INPUT e OUTPUT esposti all'orchestratore del flow"
                title="Apre il pannello Interface (INPUT/OUTPUT) sul passo Backend"
                onClick={onToggleInterface}
                className={
                  'flex h-10 min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ' +
                  (interfaceActive
                    ? 'border-sky-400 bg-sky-900/75 text-sky-50 shadow-sm ring-2 ring-sky-400/40'
                    : 'border-sky-600/40 bg-slate-900/90 text-sky-200/90 hover:border-sky-500/60 hover:bg-slate-800 hover:text-sky-100')
                }
              >
                <Unplug size={15} aria-hidden className="shrink-0 opacity-90" strokeWidth={2} />
                <span className="whitespace-nowrap">Interface</span>
              </button>
            </li>
          </>
        ) : null}
        {/*
          Pulsante "Costi" separato. Non \u00e8 uno step di costruzione: \u00e8 un visualizzatore del
          report dei costi IA filtrato per il task corrente. Per evitare confusione visiva con
          gli step "ufficiali" (1..5), \u00e8 staccato con un divider verticale e un margin esplicito
          + non ha numero n\u00e9 checkmark di completamento. Sempre cliccabile (no gating).
        */}
        {onSelectCosts ? (
          <>
            <li
              aria-hidden
              className="mx-1.5 hidden h-10 w-px shrink-0 self-center bg-slate-700 sm:block"
            />
            <li>
              <button
                type="button"
                aria-current={costsActive ? 'page' : undefined}
                aria-label="Costi di design del task: report delle chiamate IA effettuate in fase di costruzione, filtrato per questo task"
                title="Apre il pannello dei costi di design: quanto ti è costato (in chiamate IA) costruire questo task"
                onClick={onSelectCosts}
                className={
                  'flex h-10 min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ' +
                  (costsActive
                    ? 'bg-amber-600 text-amber-50 border-amber-400 shadow-sm ring-2 ring-amber-300/50'
                    : 'border-amber-600/45 bg-slate-900/90 text-amber-200 hover:border-amber-500/70 hover:bg-slate-800 hover:text-amber-100')
                }
              >
                <DollarSign size={15} aria-hidden className="shrink-0 opacity-90" strokeWidth={2} />
                <span className="whitespace-nowrap">Costi di design</span>
              </button>
            </li>
          </>
        ) : null}
        {onSelectWebhookLog ? (
          <li>
            <button
              type="button"
              aria-current={webhookLogActive ? 'page' : undefined}
              aria-label="Guardalog webhook: traccia invocazioni ConvAI verso i backend collegati"
              title="Cruscotto webhook: body IN da ElevenLabs, forward upstream e risposta RECEIVE"
              onClick={onSelectWebhookLog}
              className={
                'flex h-10 min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ' +
                (webhookLogActive
                  ? 'bg-sky-600 text-sky-50 border-sky-400 shadow-sm ring-2 ring-sky-300/50'
                  : 'border-sky-600/45 bg-slate-900/90 text-sky-200 hover:border-sky-500/70 hover:bg-slate-800 hover:text-sky-100')
              }
            >
              <Activity size={15} aria-hidden className="shrink-0 opacity-90" strokeWidth={2} />
              <span className="whitespace-nowrap">Webhook log</span>
            </button>
          </li>
        ) : null}
        {reviewPublishSlot || testSlot || deploySlot ? (
          <li className="ml-auto flex shrink-0 items-center gap-2">
            {reviewPublishSlot}
            {testSlot}
            {deploySlot}
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
