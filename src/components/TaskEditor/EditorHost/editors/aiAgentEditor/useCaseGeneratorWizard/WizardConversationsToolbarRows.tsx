/**
 * Toolbar contestuale al passo 2 «Conversazioni» del wizard use case.
 *
 * Layout v9 (inline/pill espanso):
 * - Sinistra: tre cluster outcome (positive / negative / use case emergenti) racchiusi in rettangoli appena visibili.
 *   Ogni cluster ha la sua icona-header (👍 / 👎) e le pill compatte sono ri-indicizzate
 *   localmente al cluster: `1ª 2ª 3ª…` invece dell'indice globale con buchi. La lampadina
 *   resta attributo della singola conversazione.
 * - Destra (`ml-auto`): toggle «Mostra Tokens» che attiva la versione tokenizzata nelle bubble
 *   agente (placeholder `[token]` evidenziati in giallo nella bubble view).
 *
 * Il contatore totale è nel pill dello stepper (es. `n Conversazioni` con n ≥ 0);
 * qui non viene più ripetuto.
 *
 * Storia: precedentemente esisteva un toggle Riga 2 «Mostra usecases / Mostra conversazioni»
 * e un toggle «tokenizzazione» separato. Lo switch usecases/conversazioni è stato rimosso
 * perché ridondante con lo stepper della pipeline. Il toggle «tokenizzazione» è stato
 * rinominato «Mostra Tokens» e accorpato nella stessa riga dei tab.
 *
 * Limite massimo conversazioni = `maxConversations` (default da registry). La creazione di
 * nuove conversazioni avviene esclusivamente dai 3 pulsanti contestuali nel pannello DX
 * (positiva / negativa / con use case emergente).
 */

import React from 'react';
import { Lightbulb, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { UseCaseGeneratorWizardModel } from './useUseCaseGeneratorWizard';
import { USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS } from '@domain/useCaseGeneratorWizard/registry';
import type {
  UseCaseGeneratorWizardConversation,
} from '@domain/useCaseGeneratorWizard/types';

type ConversationToolbarGroup = 'positive' | 'negative' | 'discovery';

export interface WizardConversationsToolbarRowsProps {
  wizard: UseCaseGeneratorWizardModel;
  /** Override del limite (default da registry). Usato solo per il messaggio «N/MAX». */
  maxConversations?: number;
}

/**
 * Riga unica: count conversazioni + tab numerati + toggle «Mostra Tokens».
 * Non dipende più da uno stato di view: al passo 2 la vista è sempre la bubble chat.
 */
export function WizardConversationsTabsRow({
  wizard,
  maxConversations = USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS,
}: WizardConversationsToolbarRowsProps): React.ReactElement {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-violet-500/15 bg-slate-950/40 px-3 py-1.5"
      role="toolbar"
      aria-label="Conversazioni montate e opzioni di visualizzazione"
    >
      <WizardConversationsTabsControls wizard={wizard} maxConversations={maxConversations} />
    </div>
  );
}

/**
 * Controlli inline per lo stepper espanso: gruppi outcome + toggle «Mostra Tokens».
 * Export separato per riusare lo stesso markup dentro il pill attivo della pipeline.
 */
export function WizardConversationsTabsControls({
  wizard,
  maxConversations = USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS,
}: WizardConversationsToolbarRowsProps): React.ReactElement {
  const { conversations, activeConversationId, setActiveConversationId } = wizard;

  const reachedMax = conversations.length >= maxConversations;
  /**
   * Re-indexing locale al cluster: l'ordinale visualizzato è la posizione **dentro** il
   * proprio gruppo outcome, non l'indice globale di creazione. Esempio: per la sequenza
   * globale `[+, +, -, -, +]` il cluster positive mostra `1ª 2ª 3ª` e il cluster negative
   * mostra `1ª 2ª`. Le conversazioni con use case emergenti hanno un cluster dedicato
   * giallo, perché il designer le cerca per tipologia più che per esito finale.
   */
  const discoveryItems = React.useMemo(
    () =>
      conversations
        .filter(hasActiveSuggestion)
        .map((conversation, localIndex) => ({ conversation, localIndex })),
    [conversations]
  );
  const positiveItems = React.useMemo(
    () =>
      conversations
        .filter((c) => (c.outcome ?? 'positive') === 'positive' && !hasActiveSuggestion(c))
        .map((conversation, localIndex) => ({ conversation, localIndex })),
    [conversations]
  );
  const negativeItems = React.useMemo(
    () =>
      conversations
        .filter((c) => (c.outcome ?? 'positive') === 'negative' && !hasActiveSuggestion(c))
        .map((conversation, localIndex) => ({ conversation, localIndex })),
    [conversations]
  );

  return (
    <>
      {conversations.length === 0 ? (
        <span className="text-[11px] italic text-slate-500">
          Ancora nessuna. Usa i pulsanti nel pannello a destra per crearne una.
        </span>
      ) : (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
          role="tablist"
          aria-label="Elenco conversazioni raggruppate per esito"
        >
          <ConversationOutcomeGroup
            group="discovery"
            items={discoveryItems}
            activeConversationId={activeConversationId}
            onSelect={setActiveConversationId}
          />
          <ConversationOutcomeGroup
            group="positive"
            items={positiveItems}
            activeConversationId={activeConversationId}
            onSelect={setActiveConversationId}
          />
          <ConversationOutcomeGroup
            group="negative"
            items={negativeItems}
            activeConversationId={activeConversationId}
            onSelect={setActiveConversationId}
          />
        </div>
      )}

      {reachedMax ? (
        <span
          className="text-[11px] italic text-slate-500"
          title="Limite massimo conversazioni raggiunto"
        >
          {conversations.length}/{maxConversations}
        </span>
      ) : null}
      {/*
        Toggle «Mostra Tokens» rimosso: la tokenizzazione è ora «sotto il cofano»,
        visibile solo nel JSON conversazionale. Le bubble agente del passo 2 mostrano
        sempre la frase canonica leggibile.
      */}
    </>
  );
}

/**
 * Cluster outcome con rettangolo appena visibile (border + bg a bassissima saturazione).
 * Le pill interne usano l'indice **locale** al cluster: vedi `positiveItems`/`negativeItems`.
 */
function ConversationOutcomeGroup({
  group,
  items,
  activeConversationId,
  onSelect,
}: {
  group: ConversationToolbarGroup;
  items: readonly { conversation: UseCaseGeneratorWizardConversation; localIndex: number }[];
  activeConversationId: string | null;
  onSelect: (id: string | null) => void;
}): React.ReactElement | null {
  if (items.length === 0) return null;
  const label =
    group === 'discovery'
      ? 'Conversazioni con nuovi use case trovati'
      : group === 'positive'
        ? 'Conversazioni positive'
        : 'Conversazioni negative';
  /**
   * Saturazione cluster v2 (richiesta utente): rettangoli più visibili rispetto a v1
   * (border/16 + bg /[0.04] erano «smorti»). Bordi a /55 e bg a /[0.12] mantengono il
   * tono «tenue ed elegante» ma rendono i raggruppamenti riconoscibili a colpo d'occhio.
   */
  const clusterShell =
    group === 'discovery'
      ? 'inline-flex items-center gap-2 rounded-lg border border-amber-300/55 bg-amber-400/[0.12] px-1.5 py-1 shadow-[inset_0_1px_0_rgba(252,211,77,0.08)]'
      : group === 'positive'
        ? 'inline-flex items-center gap-2 rounded-lg border border-emerald-400/55 bg-emerald-500/[0.12] px-1.5 py-1 shadow-[inset_0_1px_0_rgba(52,211,153,0.08)]'
        : 'inline-flex items-center gap-2 rounded-lg border border-rose-400/55 bg-rose-500/[0.12] px-1.5 py-1 shadow-[inset_0_1px_0_rgba(251,113,133,0.08)]';
  const iconClass =
    group === 'discovery'
      ? 'shrink-0 text-amber-300'
      : group === 'positive'
        ? 'shrink-0 text-emerald-300'
        : 'shrink-0 text-rose-300';
  return (
    <div className={clusterShell} role="group" aria-label={label}>
      <span className={iconClass} title={label} aria-hidden>
        {group === 'discovery' ? (
          <Lightbulb size={12} />
        ) : group === 'positive' ? (
          <ThumbsUp size={12} />
        ) : (
          <ThumbsDown size={12} />
        )}
      </span>
      <div className="inline-flex flex-wrap items-center gap-2">
        {items.map(({ conversation, localIndex }) => (
          <ConversationTabButton
            key={conversation.conversationId}
            conversation={conversation}
            localIndex={localIndex}
            group={group}
            isActive={conversation.conversationId === activeConversationId}
            onClick={() => onSelect(conversation.conversationId)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Pill compatta `Nª` con lampadina opzionale (use case emergenti). `localIndex` è la
 * posizione dentro il cluster outcome — la rinumerazione segue le modifiche del cluster
 * (creazione/eliminazione/cambio outcome), l'identità persistente è `conversationId`.
 */
function ConversationTabButton({
  conversation,
  localIndex,
  group,
  isActive,
  onClick,
}: {
  conversation: UseCaseGeneratorWizardConversation;
  localIndex: number;
  group: ConversationToolbarGroup;
  isActive: boolean;
  onClick: () => void;
}): React.ReactElement {
  const outcome = conversation.outcome ?? 'positive';
  const suggested = hasActiveSuggestion(conversation);
  const outcomeLabel =
    group === 'discovery'
      ? 'con nuovi use case'
      : outcome === 'positive'
        ? 'positiva'
        : 'negativa';
  const ordinal = `${localIndex + 1}ª`;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={`Conversazione ${outcomeLabel} ${localIndex + 1}${suggested && group !== 'discovery' ? ', contiene use case emergenti' : ''}`}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
        isActive
          ? 'bg-violet-600/40 text-amber-100 border border-violet-400/55'
          : 'bg-slate-900/85 text-slate-300 border border-slate-700/80 hover:bg-slate-800/90 hover:text-slate-100',
      ].join(' ')}
      title={
        group === 'discovery'
          ? `Conversazione con nuovi use case ${localIndex + 1}`
          : outcome === 'positive'
            ? `Conversazione positiva ${localIndex + 1}`
            : `Conversazione negativa ${localIndex + 1}`
      }
    >
      <span className="tabular-nums">{ordinal}</span>
      {suggested && group !== 'discovery' ? (
        <Lightbulb
          size={12}
          className="shrink-0 text-amber-300"
          aria-label="contiene use case emergenti"
        />
      ) : null}
    </button>
  );
}

function hasActiveSuggestion(conversation: UseCaseGeneratorWizardConversation): boolean {
  return conversation.turns.some(
    (t) =>
      t.role === 'agent' &&
      t.suggestion !== undefined &&
      t.suggestion.status !== 'rejected'
  );
}
