/**
 * Controlli compatti del passo 1 (use_case_list), renderizzati inline dentro il pill
 * attivo dello stepper. Layout v10 (single-line, gruppi separati):
 *
 *   [⤢ Espandi | ⤡ Collassa]   [(○) Scenario (☑ Human · ☑ LLM) | (○) Messaggio]   …
 *
 * Radio (○): intestazione riga UC — etichetta vs messaggio agente. Pill Scenario/Messaggio:
 * toggle indipendenti visibilità corpo espanso (non legati al radio).
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
  LayoutGrid,
  Maximize2,
  MessageSquareText,
  Minimize2,
  ScanSearch,
  X as XIcon,
} from 'lucide-react';
import {
  useUseCaseWizardListToolbarOptional,
  type UseCaseWizardListToolbarContextValue,
} from './UseCaseWizardListToolbarContext';
import { useOptionalAIAgentEditorDock } from '../AIAgentEditorDockContext';
import type { UseCaseGeneratorWizardModel } from './useUseCaseGeneratorWizard';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  WizardAgentBehaviorSelect,
  WizardCompileMappingBanner,
  WizardDialogControlToggle,
} from './WizardToolbarSlotMappingControls';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { UseCaseTestQuestionsToolbar } from '../useCaseTestQuestions/UseCaseTestQuestionsToolbar';
import { UseCaseOverlapCheckToolbar } from '../useCaseOverlap/UseCaseOverlapCheckToolbar';

/**
 * Glifo «token disattivati / mostra/nascondi tokenizzazione»: due parentesi quadre con
 * una X al centro — comunica visivamente «contenuto tra `[ ]` evidenziato/nascosto»,
 * meglio di `Brackets` di lucide (vuote, ambigue rispetto a un generico array).
 *
 * Disegnata su viewBox 24×24 per essere drop-in con le altre icone lucide nello stesso
 * toolbar (`size` mappa su width/height in px). `currentColor` sullo stroke così eredita
 * la palette del bottone wrapper (amber per ON, slate per OFF).
 */
function BracketsXIcon({ size = 16 }: { size?: number }): React.ReactElement {
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
  /** Per toggle Slot mapping e validazione. */
  projectSlotLexicon?: ProjectSlotLexicon;
  catalogUseCases?: readonly AIAgentUseCase[];
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
        'inline-flex h-8 w-8 items-center justify-center rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
        active
          ? activeClass
          : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * Input «cerca nei messaggi» della toolbar wizard. Commit esplicito al press di
 * Enter (non on-change) per evitare di re-renderizzare l'intera lista a ogni tasto
 * digitato. Pulsante X a destra per pulire — compare solo se il draft non è vuoto.
 *
 * Vive locale in questo file perché è strettamente legato all'UI di questa toolbar
 * (`UseCaseWizardListToolbarContext.searchSeed`); se servirà in altre toolbar lo
 * promuoveremo a `src/components/common/`.
 */
function UseCaseListSearchInput({
  ctx,
}: {
  ctx: UseCaseWizardListToolbarContextValue;
}): React.ReactElement {
  const [draft, setDraft] = React.useState<string>(ctx.searchSeed);

  /**
   * Sync inverso: se altro codice resetta il `searchSeed` (es. teardown della
   * toolbar / clear programmatico) il draft locale segue. Senza questo, l'input
   * mostrerebbe ancora la vecchia parola pur con highlight spento — confusionario.
   */
  React.useEffect(() => {
    setDraft(ctx.searchSeed);
  }, [ctx.searchSeed]);

  const commit = React.useCallback((): void => {
    ctx.setSearchSeed(draft);
  }, [ctx, draft]);

  const clearAll = React.useCallback((): void => {
    setDraft('');
    ctx.clearSearchFilter();
  }, [ctx]);

  const filterActive = ctx.searchSeed.length > 0;
  const showClear = filterActive || draft.length > 0;

  return (
    <form
      role="search"
      aria-label="Cerca nei messaggi degli use case"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      /**
       * `min-w-0 flex-1` rende l'input l'unico elemento elastico della toolbar:
       * quando la riga è larga occupa lo spazio massimo (180px circa), quando è
       * stretta si comprime fino a un minimo decoroso (vedi `min-w-[120px]` sul
       * `<input>` sotto). Tutti gli altri controlli sono `shrink-0`.
       */
      className="relative inline-flex h-8 min-w-0 flex-1 items-center"
    >
      <ScanSearch
        size={filterActive ? 16 : 14}
        strokeWidth={filterActive ? 2.25 : 2}
        aria-hidden
        className={[
          'pointer-events-none absolute left-1.5 transition-colors duration-150',
          filterActive
            ? 'text-violet-300 drop-shadow-[0_0_5px_rgba(167,139,250,0.4)]'
            : 'text-slate-500',
        ].join(' ')}
      />
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            clearAll();
          }
        }}
        placeholder="cerca nei messaggi…"
        aria-label="Testo da cercare nei messaggi degli use case"
        title={
          filterActive
            ? 'Filtro attivo — Invio per aggiornare, X o Esc per annullare'
            : 'Scrivi e premi Invio per filtrare gli use case'
        }
        className={[
          'h-8 w-full min-w-[120px] max-w-[260px] rounded-md border pr-7 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1',
          filterActive ? 'pl-8' : 'pl-7',
          filterActive
            ? 'border-violet-500/50 bg-violet-950/35 ring-violet-500/25 focus:border-violet-400/70 focus:ring-violet-500/30'
            : 'border-slate-700/70 bg-slate-900/60 focus:border-yellow-500/60 focus:ring-yellow-500/40',
        ].join(' ')}
      />
      {showClear ? (
        <button
          type="button"
          onClick={clearAll}
          aria-label="Annulla filtro"
          title="Annulla filtro (Esc)"
          className="absolute right-1 inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-800/90 hover:text-slate-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
        >
          <XIcon size={12} strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}
    </form>
  );
}

/**
 * NB (mag 2026): il pulsante «Completa correzione» è stato **rimosso** dalla toolbar
 * e sostituito dal callout {@link CompletaCorrezioneCallout}, montato nel **pannello
 * destro** «Guida rapida» sopra la review card (passo Casi d'uso con lista già
 * presente), per non rubare altezza verticale sotto lo stepper.
 * Il context (`pendingCorrectionsCount`, `triggerConsolidateCorrections`,
 * `correctionsBusy`, `correctionsDismissed`) è invariato — solo l'UI di trigger
 * è cambiata.
 */

const WIZARD_ACCORDION_FOCUS_RADIO = 'wizard-accordion-list-focus';

function AccordionFocusRadio({
  checked,
  value,
  ariaLabel,
  onSelect,
}: {
  checked: boolean;
  value: string;
  ariaLabel: string;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <input
      type="radio"
      name={WIZARD_ACCORDION_FOCUS_RADIO}
      value={value}
      checked={checked}
      aria-label={ariaLabel}
      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-violet-500"
      onChange={() => onSelect()}
      onClick={(e) => e.stopPropagation()}
    />
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
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
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
    <div className="border-t border-violet-500/20 bg-slate-950/50 px-3 py-2">
      <WizardCompileMappingBanner />
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
        role="toolbar"
        aria-label="Controlli lista use case"
      >
      <WizardStepOneListToolbarControls
        wizard={wizard}
        canShowJsonToggle={canShowJsonToggle}
        expandTheme={expandTheme}
      />
      </div>
    </div>
  );
}

export function WizardStepOneListToolbarControls({
  wizard,
  canShowJsonToggle = false,
  expandTheme = 'violet',
  projectSlotLexicon,
  catalogUseCases = [],
}: WizardStepOneListToolbarProps): React.ReactElement | null {
  const ctx = useUseCaseWizardListToolbarOptional();
  const dock = useOptionalAIAgentEditorDock();
  if (!ctx) return null;
  const {
    bulkFold,
    listAccordionHeaderMode,
    selectListAccordionHeaderMode,
    showScenario,
    showMessage,
    showActionsPanel,
    toggleScenario,
    toggleMessage,
    toggleActionsPanel,
    triggerExpandAll,
    triggerCollapseAll,
  } = ctx;

  const expandActiveClass =
    expandTheme === 'amber'
      ? 'text-amber-300 bg-amber-500/15'
      : 'text-violet-300 bg-violet-500/15';

  /**
   * Single toggle Espandi/Collassa. Stato:
   *   - `bulkFold === 'expanded'`  → la lista è completamente espansa, l'unica
   *     azione utile è collassare. Mostriamo «Collassa» + Minimize2.
   *   - altrimenti (`'collapsed'` o `'mixed'`) → mostriamo «Espandi» + Maximize2.
   *
   * Sostituisce la coppia di pulsanti separati: meno rumore visivo, e il toggle
   * resta semantically corretto (è sempre un'azione "porta tutto allo stato opposto
   * dell'attuale"). Tooltip chiarisce sempre l'azione che il click eseguirà.
   */
  const isFullyExpanded = bulkFold === 'expanded';
  const expandCollapseToggle = (
    <button
      type="button"
      title={
        isFullyExpanded
          ? 'Collassa tutte le card'
          : 'Espandi tutte le card'
      }
      aria-label={isFullyExpanded ? 'Collassa tutte le card' : 'Espandi tutte le card'}
      onClick={isFullyExpanded ? triggerCollapseAll : triggerExpandAll}
      className={[
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
        expandActiveClass,
      ].join(' ')}
    >
      {isFullyExpanded ? (
        <Minimize2 size={15} aria-hidden />
      ) : (
        <Maximize2 size={15} aria-hidden />
      )}
      <span>{isFullyExpanded ? 'Collassa' : 'Espandi'}</span>
    </button>
  );

  return (
    <>
      <div
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-violet-400/15 bg-violet-500/[0.04] p-0.5"
        role="group"
        aria-label="Espansione lista use case"
      >
        {expandCollapseToggle}
      </div>
      <div
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-600/20 bg-slate-900/30 p-0.5"
        role="group"
        aria-label="Campi visibili nello use case"
      >
        <span className="inline-flex items-center gap-0.5">
          <AccordionFocusRadio
            checked={listAccordionHeaderMode === 'label'}
            value="label"
            ariaLabel="Intestazione riga: etichetta use case"
            onSelect={() => selectListAccordionHeaderMode('label')}
          />
          <LabeledInlineToggle
            active={showScenario}
            onClick={toggleScenario}
            title="Mostra/nascondi lo scenario nel corpo espanso"
            activeClass="text-violet-300 bg-violet-500/15"
            icon={<BookOpen size={15} aria-hidden />}
            label="Scenario"
          />
        </span>
        <span className="inline-flex items-center gap-0.5">
          <AccordionFocusRadio
            checked={listAccordionHeaderMode === 'message'}
            value="message"
            ariaLabel="Intestazione riga: messaggio agente"
            onSelect={() => selectListAccordionHeaderMode('message')}
          />
          <LabeledInlineToggle
            active={showMessage}
            onClick={toggleMessage}
            title="Mostra/nascondi il blocco messaggio nel corpo espanso"
            activeClass="text-emerald-300 bg-emerald-500/15"
            icon={<MessageSquareText size={15} aria-hidden />}
            label="Messaggio"
          />
        </span>
        <LabeledInlineToggle
          active={showActionsPanel}
          onClick={toggleActionsPanel}
          title="Mostra/nascondi il pannello azioni (trascina nel response)"
          activeClass="text-amber-300 bg-amber-500/15"
          icon={<LayoutGrid size={15} aria-hidden />}
          label="Azioni"
        />
      </div>
      {/* (rimosso) CompletaCorrezioneButton: la CTA vive ora nel callout sotto la toolbar (vedi `CompletaCorrezioneCallout`). */}
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
            'inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 text-[13px] font-black leading-none tracking-tight transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
            dock.useCaseSiblingSortMode === 'alphabetical'
              ? 'bg-violet-500/15 text-violet-200'
              : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300',
          ].join(' ')}
        >
          <span aria-hidden>A↓B</span>
        </button>
      ) : null}
      {/*
        Search input: l'unico elemento "elastico" della toolbar; può ridursi se la
        riga è stretta (vedi container `flex` senza wrap in `ContextualToolbarRow`).
      */}
      <UseCaseListSearchInput ctx={ctx} />
      <UseCaseTestQuestionsToolbar />
      <UseCaseOverlapCheckToolbar />
      {dock && projectSlotLexicon ? (
        <WizardDialogControlToggle
          lexicon={projectSlotLexicon}
          useCases={catalogUseCases}
          backendOutputSlotBindings={dock.backendOutputSlotBindings}
          backendLinked={
            mergeConvaiBackendToolIdLists(
              dock.iaRuntimeConfig?.convaiBackendToolTaskIds ?? [],
              []
            ).length > 0
          }
        />
      ) : null}
      {dock ? (
        <WizardAgentBehaviorSelect
          agentBehavior={dock.agentBehavior}
          onAgentBehaviorChange={dock.setAgentBehavior}
        />
      ) : null}
      {/*
        Toggle «Mostra JSON» ({}) e «Mostra Tokens» ([x]) rimossi dalla toolbar:
        la tokenizzazione resta «sotto il cofano» — visibile solo nel JSON conversazionale
        (pannello DX nei passi dedicati). Le icone interferivano col messaggio canonico
        leggibile e duplicavano controlli già accessibili da altri punti.
        I prop `wizard` e `canShowJsonToggle` restano in firma per compat, ignorati qui.
      */}
    </>
  );
}
