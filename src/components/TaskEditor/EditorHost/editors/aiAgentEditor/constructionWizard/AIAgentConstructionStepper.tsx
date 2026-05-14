/**
 * AI Agent Construction Wizard — Stepper di alto livello (5 bottoni numerati).
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
 *   - 🟡 attivo (selezionato) → highlight viola
 *   - ✅ completato → verde + check
 *
 * Render compatto: solo bottoni step, senza caption/progress bar duplicata.
 */

import React from 'react';
import { Check, DollarSign, Lock } from 'lucide-react';
import {
  AGENT_WIZARD_STEP_COUNT,
  type AgentWizardStepIndex,
} from '@domain/aiAgentConstruction/agentConstructionPhase';
import { AGENT_WIZARD_STEPS_META } from './agentWizardStepsMeta';

export interface AIAgentConstructionStepperProps {
  readonly currentStep: AgentWizardStepIndex;
  readonly completion: readonly boolean[];
  readonly onSelectStep: (index: AgentWizardStepIndex) => void;
  /**
   * Quando valorizzato, il pulsante dello step indicato riceve un effetto «glow» viola
   * pulsante. Usato per richiamare l'attenzione sul primo step subito dopo l'uscita dalla
   * Tutor di benvenuto (transizione di sessione, ~4s). `null` = nessuno step in glow.
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
   * Slot opzionale renderizzato all'estrema destra dello stepper, dopo il pulsante "Costi".
   * Tipicamente contiene il dropdown «Deploy»: il parent decide quando mostrarlo (es. solo
   * a wizard completato) per non distrarre durante la costruzione iniziale. Quando `null`
   * o `undefined`, lo spazio non viene riservato.
   */
  readonly deploySlot?: React.ReactNode;
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
  deploySlot = null,
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
          const isCurrent = !costsActive && meta.index === currentStep;
          const isComplete = completion[meta.index] === true;
          const isEnabled = enabled[meta.index] === true;
          const Icon = meta.icon;

          const isGlow = glowStepIndex === meta.index;
          const stateClass = isCurrent
            ? 'bg-violet-700 text-white border-violet-500 shadow ring-2 ring-violet-400/40'
            : isComplete
              ? 'bg-emerald-900/55 text-emerald-100 border-emerald-700 hover:bg-emerald-900/70'
              : isEnabled
                ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed';
          /**
           * Glow viola transitorio (4s ~ controllato dal parent). Sovrappone un anello
           * pulsante e una shadow viola al pulsante dello step da evidenziare. Non
           * sostituisce il `stateClass` ma si aggiunge: lo step glowing che è anche
           * `current` ottiene un doppio effetto (ring viola pulsante + ring statico).
           */
          const glowClass = isGlow
            ? 'animate-pulse ring-4 ring-violet-400/70 shadow-[0_0_22px_rgba(167,139,250,0.7)]'
            : '';

          return (
            <li key={meta.index}>
              <button
                type="button"
                disabled={!isEnabled}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Passo ${meta.displayNumber}: ${meta.title}${
                  isComplete ? ' (completato)' : isEnabled ? '' : ' (bloccato)'
                }`}
                onClick={() => {
                  if (isEnabled) onSelectStep(meta.index);
                }}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${stateClass} ${glowClass}`}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-black/25 text-[11px] font-semibold"
                  aria-hidden
                >
                  {isComplete ? (
                    <Check size={12} className="text-emerald-300" />
                  ) : !isEnabled ? (
                    <Lock size={11} />
                  ) : (
                    meta.displayNumber
                  )}
                </span>
                <Icon size={13} aria-hidden className="opacity-80" />
                <span>{meta.label}</span>
              </button>
            </li>
          );
        })}
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
              className="mx-2 hidden h-6 w-px bg-slate-700 sm:block"
            />
            <li>
              <button
                type="button"
                aria-current={costsActive ? 'page' : undefined}
                aria-label="Costi di design del task: report delle chiamate IA effettuate in fase di costruzione, filtrato per questo task"
                title="Apre il pannello dei costi di design: quanto ti è costato (in chiamate IA) costruire questo task"
                onClick={onSelectCosts}
                className={
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ' +
                  (costsActive
                    ? 'bg-amber-700 text-white border-amber-500 shadow ring-2 ring-amber-400/40'
                    : 'bg-slate-800 text-amber-200 border-slate-700 hover:bg-slate-700')
                }
              >
                <DollarSign size={13} aria-hidden className="opacity-90" />
                <span>Costi di design</span>
              </button>
            </li>
          </>
        ) : null}
        {deploySlot ? <li className="ml-auto">{deploySlot}</li> : null}
      </ol>
    </nav>
  );
}
