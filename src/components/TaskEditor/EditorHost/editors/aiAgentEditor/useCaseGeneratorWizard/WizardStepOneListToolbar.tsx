/**
 * Controlli compatti del passo 1 (use_case_list), renderizzati inline dentro il pill
 * attivo dello stepper. Layout v10 (single-line, gruppi separati):
 *
 *   [⤢ Espandi | ⤡ Collassa]   [📖 Scenario | 💬 Messaggio]   A↓B   { }   [ ]
 *
 * Le icone scenario/messaggio agente sono colorate con lo **stesso** colore del font usato
 * nei pill scenario/messaggio dentro lo use case body (vedi `UC_PILL_SCENARIO` /
 * `UC_PILL_AGENT_MSG`). Espandi/collassa adottano il **colore tema** del passo (violet
 * di default; il prop `expandTheme` esiste ancora per retro-compatibilità ma il Passo 3
 * non monta più questa toolbar — vedi nota su {@link ActiveStepInlineControls}).
 *
 * A destra del grid (in flusso flex): AB sort (se dock disponibile), toggle Anteprima
 * JSON (`canShowJsonToggle`), toggle «Mostra Tokens» ({@link WizardShowTokensToggle}).
 *
 * Il toggle «Mostra Tokens» è esportato a parte perché viene riusato anche nel Passo 3
 * (dove la 2×2 grid non ha più senso, vedi v8 in `AIAgentEditorDockPanels.tsx`) e
 * implicitamente nel Passo 2 dentro `WizardConversationsToolbarRows`.
 *
 * Estratta da `ViewSkaGenerator.tsx` per rispettare la dimensione massima file.
 * I controlli operano sul `UseCaseWizardListToolbarContext`; la barra è invisibile se il provider manca.
 */

import React from 'react';
import {
  BookOpen,
  Braces,
  Maximize2,
  MessageSquareText,
  Minimize2,
} from 'lucide-react';
import { useUseCaseWizardListToolbarOptional } from './UseCaseWizardListToolbarContext';
import { useOptionalAIAgentEditorDock } from '../AIAgentEditorDockContext';
import type { UseCaseGeneratorWizardModel } from './useUseCaseGeneratorWizard';

/**
 * Glifo «token disattivati / mostra/nascondi tokenizzazione»: due parentesi quadre con
 * una X al centro — comunica visivamente «contenuto tra `[ ]` evidenziato/nascosto»,
 * meglio di `Brackets` di lucide (vuote, ambigue rispetto a un generico array).
 *
 * Disegnata su viewBox 24×24 per essere drop-in con le altre icone lucide nello stesso
 * toolbar (`size` mappa su width/height in px). `currentColor` sullo stroke così eredita
 * la palette del bottone wrapper (amber per ON, slate per OFF).
 */
function BracketsXIcon({ size = 14 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4 H4 V20 H7" />
      <path d="M17 4 H20 V20 H17" />
      <path d="M9.5 9.5 L14.5 14.5" />
      <path d="M14.5 9.5 L9.5 14.5" />
    </svg>
  );
}

export interface WizardStepOneListToolbarProps {
  /**
   * Wizard model: necessario per il toggle «Mostra JSON» (legge `showJsonPanel` /
   * `toggleShowJsonPanel`). Omettendolo il toggle JSON è nascosto, anche se
   * `canShowJsonToggle` è true (degrado pulito).
   */
  wizard?: UseCaseGeneratorWizardModel;
  /**
   * Mostra il toggle «Mostra JSON» quando true. Il caller calcola la condizione composta
   * (`useCaseCount > 0 && tokenizedUseCaseCount > 0 && step === 'use_case_list'`); così
   * questa toolbar resta dichiarativa e non duplica le regole di visibilità.
   */
  canShowJsonToggle?: boolean;
  /**
   * Tema icona-toggle per espandi/collassa: «violet» per il passo 1 (Casi d'uso), «amber»
   * per il passo 3 (Tokenizzazione). Le icone scenario/messaggio agente restano sempre
   * fedeli ai colori del campo (violetto / emerald) — vedi nota di intestazione.
   */
  expandTheme?: 'violet' | 'amber';
}

/**
 * Bottone icona compatto 24×24 con stato attivo. Sostituisce le pill testuali
 * (`espandi`/`collassa`/`scenario`/`frasi`) nella vista inline del pill stepper.
 *
 * - `active=true`: applica `activeClass` (es. `text-violet-300 bg-violet-500/15`).
 * - `active=false`: stato dim/slate, hover schiarisce.
 *
 * Esportato perché riusato dal toggle «Mostra Tokens» in altri passi (vedi
 * {@link WizardShowTokensToggle}) — la stessa icon-pill garantisce coerenza visiva
 * fra controlli del Passo 1 e quelli che vivono fuori da questa toolbar.
 */
export function CompactIconToggle({
  active,
  onClick,
  title,
  ariaLabel,
  activeClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  ariaLabel?: string;
  activeClass: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel ?? title}
      title={title}
      onClick={onClick}
      className={[
        'inline-flex h-7 w-7 items-center justify-center rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
        active
          ? activeClass
          : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function LabeledInlineToggle({
  active,
  onClick,
  title,
  activeClass,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  activeClass: string;
  icon: React.ReactNode;
  label: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={[
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
        active
          ? activeClass
          : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * Toggle «Mostra Tokens» riusabile (Passo 1, Passo 3 e — implicitamente — Passo 2 via
 * la toolbar conversazioni). Quando ON:
 *  - la bubble agente nel Passo 2 mostra la versione tokenizzata (giallo);
 *  - il `messaggio agente` nel body dello use case (composer wizard) mostra la
 *    tokenizzazione al posto della frase canonica;
 * — un solo stato condiviso (`wizard.showTokenizedInBubbles`), così l'esperienza
 * resta coerente attraversando i passi.
 *
 * Icona: `[X]` custom (vedi {@link BracketsXIcon}) — comunica «contenuto tokenizzato»
 * meglio delle parentesi quadre vuote che potrebbero essere lette come array generico.
 */
export function WizardShowTokensToggle({
  wizard,
}: {
  wizard: UseCaseGeneratorWizardModel;
}): React.ReactElement {
  return (
    <CompactIconToggle
      active={wizard.showTokenizedInBubbles}
      onClick={wizard.toggleShowTokenizedInBubbles}
      title={
        wizard.showTokenizedInBubbles
          ? 'Nascondi i token [placeholder] (mostra la frase canonica)'
          : 'Mostra i token [placeholder] al posto della frase canonica'
      }
      ariaLabel="Mostra/nascondi tokenizzazione"
      activeClass="text-amber-300 bg-amber-500/15"
    >
      <BracketsXIcon size={14} />
    </CompactIconToggle>
  );
}

/**
 * Variante non più montata dal layout v8 (pre-2×2 grid). Mantenuta come export pubblico
 * per non rompere consumer esterni / test; rende un wrapper che chiama i controlli compatti.
 */
export function WizardStepOneListToolbar({
  visible,
  wizard,
  canShowJsonToggle = false,
  expandTheme = 'violet',
}: WizardStepOneListToolbarProps & { visible: boolean }): React.ReactElement | null {
  if (!visible) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-violet-500/20 bg-slate-950/50 px-3 py-2"
      role="toolbar"
      aria-label="Controlli lista use case"
    >
      <WizardStepOneListToolbarControls
        wizard={wizard}
        canShowJsonToggle={canShowJsonToggle}
        expandTheme={expandTheme}
      />
    </div>
  );
}

export function WizardStepOneListToolbarControls({
  wizard,
  canShowJsonToggle = false,
  expandTheme = 'violet',
}: WizardStepOneListToolbarProps): React.ReactElement | null {
  const ctx = useUseCaseWizardListToolbarOptional();
  const dock = useOptionalAIAgentEditorDock();
  if (!ctx) return null;
  const {
    bulkFold,
    showScenario,
    showMessage,
    toggleScenario,
    toggleMessage,
    triggerExpandAll,
    triggerCollapseAll,
  } = ctx;

  const expandActiveClass =
    expandTheme === 'amber'
      ? 'text-amber-300 bg-amber-500/15'
      : 'text-violet-300 bg-violet-500/15';

  return (
    <>
      <div
        className="inline-flex items-center gap-1 rounded-lg border border-violet-400/15 bg-violet-500/[0.04] p-0.5"
        role="group"
        aria-label="Espansione lista use case"
      >
        <LabeledInlineToggle
          active={bulkFold === 'expanded'}
          onClick={triggerExpandAll}
          title="Espandi tutte le card"
          activeClass={expandActiveClass}
          icon={<Maximize2 size={13} aria-hidden />}
          label="Espandi"
        />
        <LabeledInlineToggle
          active={bulkFold === 'collapsed'}
          onClick={triggerCollapseAll}
          title="Collassa tutte le card"
          activeClass={expandActiveClass}
          icon={<Minimize2 size={13} aria-hidden />}
          label="Collassa"
        />
      </div>
      <div
        className="inline-flex items-center gap-1 rounded-lg border border-slate-600/20 bg-slate-900/30 p-0.5"
        role="group"
        aria-label="Campi visibili nello use case"
      >
        <LabeledInlineToggle
          active={showScenario}
          onClick={toggleScenario}
          title="Mostra/nascondi lo scenario"
          activeClass="text-violet-300 bg-violet-500/15"
          icon={<BookOpen size={13} aria-hidden />}
          label="Scenario"
        />
        <LabeledInlineToggle
          active={showMessage}
          onClick={toggleMessage}
          title="Mostra/nascondi il messaggio agente"
          activeClass="text-emerald-300 bg-emerald-500/15"
          icon={<MessageSquareText size={13} aria-hidden />}
          label="Messaggio"
        />
      </div>
      {dock ? (
        <button
          type="button"
          aria-pressed={dock.useCaseSiblingSortMode === 'alphabetical'}
          onClick={() =>
            dock.setUseCaseSiblingSortMode(
              dock.useCaseSiblingSortMode === 'alphabetical' ? 'logical' : 'alphabetical'
            )
          }
          title={
            dock.useCaseSiblingSortMode === 'alphabetical'
              ? 'Ordine alfabetico tra fratelli — clic per ordine dialogo'
              : 'Ordine dialogo (lista/API) — clic per ordine alfabetico'
          }
          aria-label="Ordina alfabeticamente"
          className={[
            'inline-flex h-7 min-w-8 items-center justify-center rounded-md px-1.5 text-[13px] font-black leading-none tracking-tight transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
            dock.useCaseSiblingSortMode === 'alphabetical'
              ? 'bg-violet-500/15 text-violet-200'
              : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300',
          ].join(' ')}
        >
          <span aria-hidden>A↓B</span>
        </button>
      ) : null}
      {wizard && canShowJsonToggle ? (
        <CompactIconToggle
          active={wizard.showJsonPanel}
          onClick={wizard.toggleShowJsonPanel}
          title={
            wizard.showJsonPanel
              ? 'Nascondi il preview JSON nel pannello destro'
              : 'Mostra il JSON conversazionale nel pannello destro'
          }
          ariaLabel="Mostra/nascondi JSON conversazionale"
          activeClass="text-violet-300 bg-violet-500/15"
        >
          <Braces size={13} aria-hidden />
        </CompactIconToggle>
      ) : null}
      {wizard ? <WizardShowTokensToggle wizard={wizard} /> : null}
    </>
  );
}
