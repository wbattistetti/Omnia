/**
 * `ConversationStyleEditor` — gate di stile **v2 multi-pill** del passo «Conversazione»
 * del wizard use case. Sostituisce il vecchio `ConversationsStyleGate` (singolo
 * esempio testuale) consentendo al designer di:
 *
 *  1. Attivare uno o più stili di registro (Cortese, Ironico, Formale, ...) con la
 *     **checkbox accanto a ciascuna pill**.
 *  2. Cliccare una pill per **editarla** sotto: descrizione (precompilata col contract
 *     di registry, modificabile per micro-variazioni) + esempi di dialogo (placeholder
 *     guida quando vuoto).
 *  3. Spuntare la checkbox **GLOBALE** «Lascia che Omnia scelga uno stile»: in quel
 *     caso gli esempi non sono più richiesti — l'AI inventa frasi nello stile descritto.
 *
 * Il batch di generazione (gestito dal pannello padre) produce **una conversazione per
 * ogni stile checkato**. Ogni conversazione viene taggata con `styleId` per supportare
 * il filtro di vista sopra le bubble e la selezione dello stile target di Upload.
 *
 * Gate per-pill (visivo): se l'utente clicca «genera» con almeno una pill checkata in
 * stato non-valido (descrizione vuota OPPURE — quando auto OFF — esempio vuoto), il
 * padre invoca `triggerFlashFor(styleId)` e questo componente lampeggia in ambra
 * **solo sulla pill colpevole**, accompagnato da payoff inline sotto la pill.
 *
 * Stato: tutto controllato dal padre (`selections` + `auto` + setter). Niente state
 * interno se non `selectedStyleId` (quale pill è in editing) — locale, non persistito.
 *
 * Fail-loud: chiavi sconosciute al registry vengono filtrate visivamente (non si
 * crea una pill fantasma); se il padre passa `selections` malformate, la pill viene
 * ignorata anziché crashare il pannello.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import {
  AI_AGENT_GLOBAL_USE_CASE_STYLES,
} from '../constants';
import {
  type ConversationStyleEntry,
  type ConversationStyleSelections,
  defaultStyleEntryForRegistryId,
} from '@domain/aiAgentConversationStyle/conversationStyleSelections';

export interface ConversationStyleEditorProps {
  /** Stato persistito (per styleId): override + flag checked. */
  readonly selections: ConversationStyleSelections;
  /** Setter (functional updater supportato). */
  readonly onSelectionsChange: (
    next:
      | ConversationStyleSelections
      | ((prev: ConversationStyleSelections) => ConversationStyleSelections)
  ) => void;
  /** Checkbox GLOBALE «Lascia che Omnia scelga uno stile». */
  readonly auto: boolean;
  readonly onAutoChange: (next: boolean) => void;
  /**
   * StyleId della pill che deve lampeggiare in ambra (gate fallito su quella pill).
   * `null` = nessun lampeggio. Reset asincrono dal padre dopo ~800ms.
   */
  readonly flashingStyleId?: string | null;
  /**
   * Messaggio payoff inline mostrato sotto la pill colpevole (es. «Inserisci almeno
   * un esempio per lo stile X»). `null` = niente payoff.
   */
  readonly payoffMessageByStyleId?: Readonly<Record<string, string | null>>;
}

const PILL_BASE =
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60';

const PILL_INACTIVE = 'border-slate-700/70 bg-slate-900/60 text-slate-300 hover:bg-slate-800/80';
const PILL_ACTIVE = 'border-sky-400/80 bg-sky-950/55 text-sky-100 shadow-[inset_0_1px_0_rgba(56,189,248,0.18)]';

/**
 * Pill cliccabile (selezione editing) + checkbox dentro la pill (attivazione generazione).
 * La checkbox cliccata propaga ANCHE la selezione (così se attivi uno stile lo vedi sotto
 * subito senza un secondo click — UX coerente).
 */
function StylePill({
  styleId,
  label,
  selected,
  checked,
  flashing,
  onSelect,
  onToggle,
}: {
  styleId: string;
  label: string;
  selected: boolean;
  checked: boolean;
  flashing: boolean;
  onSelect: () => void;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      data-style-id={styleId}
      className={[
        PILL_BASE,
        selected ? PILL_ACTIVE : PILL_INACTIVE,
        flashing ? 'animate-omnia-style-flash' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={`Stile «${label}» — clicca per editare, usa la checkbox per attivare`}
    >
      {/*
        Checkbox separata: stopPropagation per non scatenare anche `onSelect` (tuttavia
        la attivazione propaga la selezione via `onToggle`, vedi commento sopra).
        accent-sky → coerente col tema del passo Conversazione.
      */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-3 w-3 cursor-pointer accent-sky-500"
        aria-label={`Attiva lo stile ${label} per la generazione`}
      />
      <span>{label}</span>
    </button>
  );
}

export function ConversationStyleEditor({
  selections,
  onSelectionsChange,
  auto,
  onAutoChange,
  flashingStyleId = null,
  payoffMessageByStyleId,
}: ConversationStyleEditorProps): React.ReactElement {
  /**
   * Pill "in editing": locale (niente persistenza). Default a `null` → mostra placeholder
   * «Clicca uno stile sopra per configurarlo». Se l'utente clicca o checka una pill,
   * quella diventa selezionata e il pannello sotto si popola.
   */
  const [selectedStyleId, setSelectedStyleId] = React.useState<string | null>(null);

  const selectedStyle = React.useMemo(
    () => AI_AGENT_GLOBAL_USE_CASE_STYLES.find((s) => s.id === selectedStyleId) ?? null,
    [selectedStyleId]
  );

  /**
   * Entry per la pill in editing. Se non esiste in `selections` (l'utente non ha mai toccato
   * questa pill) usiamo i default da registry — ma non scriviamo niente finché non c'è una
   * modifica esplicita (no side-effect su click selezione).
   */
  const selectedEntry: ConversationStyleEntry | null = React.useMemo(() => {
    if (!selectedStyleId) return null;
    if (selections[selectedStyleId]) return selections[selectedStyleId];
    try {
      return defaultStyleEntryForRegistryId(selectedStyleId);
    } catch {
      return null;
    }
  }, [selectedStyleId, selections]);

  /** Patch idempotente di una entry (crea se manca, merge altrimenti). */
  const patchEntry = React.useCallback(
    (styleId: string, patch: Partial<ConversationStyleEntry>) => {
      onSelectionsChange((prev) => {
        const base = prev[styleId] ?? defaultStyleEntryForRegistryId(styleId);
        const next: ConversationStyleEntry = { ...base, ...patch };
        if (
          next.checked === base.checked &&
          next.description === base.description &&
          next.example === base.example &&
          prev[styleId]
        ) {
          return prev;
        }
        return { ...prev, [styleId]: next };
      });
    },
    [onSelectionsChange]
  );

  const handleToggle = React.useCallback(
    (styleId: string) => {
      const wasChecked = selections[styleId]?.checked === true;
      patchEntry(styleId, { checked: !wasChecked });
      // UX: toggling propaga anche la selezione editing (vedi nota su StylePill).
      setSelectedStyleId(styleId);
    },
    [selections, patchEntry]
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-950/40">
      {/* Riga pill: checkbox+label con flash per-pill. */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-sky-500/20 px-3 py-2"
        role="tablist"
        aria-label="Stili di registro per la generazione conversazioni"
      >
        <Sparkles size={14} className="shrink-0 text-sky-300" aria-hidden />
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-sky-200">
          Stili
        </span>
        {AI_AGENT_GLOBAL_USE_CASE_STYLES.map((style) => {
          const checked = selections[style.id]?.checked === true;
          const flashing = flashingStyleId === style.id;
          return (
            <StylePill
              key={style.id}
              styleId={style.id}
              label={style.label}
              selected={selectedStyleId === style.id}
              checked={checked}
              flashing={flashing}
              onSelect={() => setSelectedStyleId(style.id)}
              onToggle={() => handleToggle(style.id)}
            />
          );
        })}
      </div>

      {/*
        Pannello editor della pill selezionata. Usa `flex-col` con `min-h-0` per consentire
        alla textarea «Esempi di dialogo» (l'unico blocco `flex-1`) di assorbire tutto lo
        spazio verticale rimanente fino al footer. La descrizione resta a dimensione fissa
        (`shrink-0`) — micro-variazioni di registro tipicamente sono brevi.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3">
        {selectedStyle && selectedEntry ? (
          <>
            <div className="shrink-0">
              <label
                htmlFor="conversation-style-description"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-sky-200"
              >
                Descrizione stile
              </label>
              <textarea
                id="conversation-style-description"
                value={selectedEntry.description}
                onChange={(e) => patchEntry(selectedStyle.id, { description: e.target.value })}
                rows={2}
                className="w-full resize-y rounded-md border border-slate-700/80 bg-slate-950/80 p-2 font-mono text-[12px] leading-relaxed text-slate-100 focus:border-sky-400/70 focus:outline-none focus:ring-1 focus:ring-sky-400/40"
                aria-label={`Descrizione dello stile ${selectedStyle.label}`}
                spellCheck
              />
              <p className="mt-1 text-[10px] leading-snug text-slate-500">
                Default dal registro; modificalo per micro-variazioni.
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <label
                htmlFor="conversation-style-example"
                className="mb-1 block shrink-0 text-[11px] font-semibold uppercase tracking-wide text-sky-200"
              >
                Esempi di dialogo
              </label>
              <textarea
                id="conversation-style-example"
                value={selectedEntry.example}
                onChange={(e) => patchEntry(selectedStyle.id, { example: e.target.value })}
                placeholder={
                  'Scrivi qui un esempio di dialogo nello stile che vorresti, bastano pochi turni.\n\nEsempio:\nUtente: Ciao, vorrei prenotare per due\nAgente: Volentieri, per quale data?'
                }
                className="min-h-0 w-full flex-1 resize-none rounded-md border border-slate-700/80 bg-slate-950/80 p-2 font-mono text-[12px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-sky-400/70 focus:outline-none focus:ring-1 focus:ring-sky-400/40"
                aria-label={`Esempi di dialogo per lo stile ${selectedStyle.label}`}
                spellCheck
              />
              {payoffMessageByStyleId?.[selectedStyle.id] ? (
                <p
                  role="alert"
                  className="mt-1 shrink-0 text-[11px] font-semibold leading-snug text-rose-300"
                >
                  {payoffMessageByStyleId[selectedStyle.id]}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-[12px] italic text-slate-500">
              Clicca uno stile sopra per configurarlo.
            </p>
          </div>
        )}
      </div>

      {/* Footer: checkbox auto globale. */}
      <div className="shrink-0 border-t border-sky-500/20 px-3 py-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-slate-300">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => onAutoChange(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-sky-500"
            aria-label="Lascia che Omnia scelga uno stile"
          />
          <span>Lascia che Omnia scelga uno stile</span>
          <span className="ml-1 text-[10px] text-slate-500">
            (gli esempi diventano opzionali per ogni stile checkato)
          </span>
        </label>
      </div>
    </div>
  );
}
