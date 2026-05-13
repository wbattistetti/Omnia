/**
 * Pannello SX passo 2 (conversations): vista bubble chat della conversazione attiva, con pillola
 * informativa (non cliccabile) della use case sorgente sotto ogni bubble agente. Editing inline
 * turni (user e agent).
 *
 * Particolarità modello bubble = canonical:
 * - bubble agente reale: editarla modifica la frase canonica del caso d'uso e si propaga a tutte
 *   le altre bubble dello stesso useCaseId (gestito dal hook). Pillola «use case» + tooltip avviso.
 * - bubble agente con suggestion `pending`: pillola amber «💡 Suggerito», azioni inline
 *   «Aggiungi al catalogo» / «Scarta». L'edit cambia solo la bubble locale.
 * - bubble agente con suggestion `rejected`: pillola grigia, testo barrato, edit disabilitato.
 *
 * Toggle «Mostra Tokens» (prop `showTokenized`):
 * - OFF: bubble agente mostra la frase canonica «come la dice l'agente» (default).
 * - ON: bubble agente mostra la versione tokenizzata corrispondente — i segmenti `[token]` sono
 *   evidenziati in giallo (`text-amber-300`). In questa modalità la bubble è READ-ONLY: la
 *   tokenizzazione si edita esplicitamente al Passo 3 «Tokenizzazione», qui è solo overlay
 *   visivo. Le bubble di use case `suggested:*` (senza canonico ancora) o senza tokenized
 *   restano sulla frase normale anche con il toggle attivo.
 *
 * Stato vivo nel wizard model; questo componente è solo presentazionale.
 */

import React from 'react';
import { BookOpen, Bot, Check, Lightbulb, MessageSquareText, Pencil, User, X } from 'lucide-react';
import type {
  UseCaseGeneratorWizardConversation,
  UseCaseGeneratorWizardTurn,
  UseCaseGeneratorWizardTurnAgent,
} from '@domain/useCaseGeneratorWizard/types';
import { TokenizedHighlightedText } from './TokenizedHighlightedText';

export interface ConversationsBubbleViewProps {
  /** Lista completa per indicizzare l'attiva. */
  conversations: readonly UseCaseGeneratorWizardConversation[];
  activeConversationId: string | null;
  /** Edit inline turno (user o agent). Il dispatch al canonico è gestito dal hook. */
  onUpdateTurnText: (conversationId: string, turnId: string, text: string) => void;
  /** Bubble agente con testo diverso dalla baseline AI: per evidenziare visualmente la modifica. */
  modifiedAgentTurnKeysByConversation: Readonly<Record<string, readonly string[]>>;
  /** Promuovi suggestion `pending` → use case reale. */
  onPromoteSuggestion?: (conversationId: string, turnId: string) => void | Promise<void>;
  /** Scarta suggestion `pending` → stato `rejected`. */
  onRejectSuggestion?: (conversationId: string, turnId: string) => void;
  /**
   * Toggle «Mostra Tokens»: quando true, la frase principale della bubble agente viene SOSTITUITA
   * con la versione tokenizzata (placeholder `[token]` in giallo) — vedi
   * {@link tokenizedByUseCaseId}. Bubble di use case `suggested:*` o senza tokenized restano sulla
   * frase normale. In modalità ON la bubble è read-only: la tokenizzazione si edita al Passo 3.
   */
  showTokenized?: boolean;
  /** Mappa `useCaseId → assistant_example_tokenized` per le bubble agente. */
  tokenizedByUseCaseId?: Readonly<Record<string, string>>;
  /**
   * Set degli `useCaseId` che il designer ha **escluso** dalle conversazioni (toggle nell'header
   * della lista use case). Le bubble agente di questi use case vengono **nascoste dalla vista**
   * (i turni restano per\u00f2 in storage: se il use case viene re-incluso, riappaiono). I turni
   * `user` non vengono filtrati \u2014 non hanno appartenenza univoca a un use case e rimuoverli
   * complicherebbe il rendering senza valore aggiunto. Vuoto / undefined = nessun filtro.
   */
  excludedUseCaseIds?: ReadonlySet<string>;
}

export function ConversationsBubbleView({
  conversations,
  activeConversationId,
  onUpdateTurnText,
  modifiedAgentTurnKeysByConversation,
  onPromoteSuggestion,
  onRejectSuggestion,
  showTokenized = false,
  tokenizedByUseCaseId,
  excludedUseCaseIds,
}: ConversationsBubbleViewProps): React.ReactElement {
  const active = React.useMemo(() => {
    if (!activeConversationId) return conversations[0] ?? null;
    return conversations.find((c) => c.conversationId === activeConversationId) ?? null;
  }, [conversations, activeConversationId]);

  if (!active) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-6 text-center text-sm text-slate-400">
        <p className="max-w-md leading-relaxed">
          Nessuna conversazione ancora montata. Usa il pulsante{' '}
          <span className="font-semibold text-amber-100">Crea conversazioni</span> nel pannello a
          destra per generarne una mescolando più use case.
        </p>
      </div>
    );
  }

  const modifiedTurnIds = new Set<string>(
    modifiedAgentTurnKeysByConversation[active.conversationId] ?? []
  );
  const outcome = active.outcome ?? 'positive';
  /**
   * Ordinale **locale al cluster outcome**, coerente con le pill della toolbar Passo 2:
   * la conversazione attiva è la N-esima dentro il proprio outcome (positive/negative),
   * non la N-esima globale. Esempio: globale 5 → 3ª positiva se è la terza positive nel
   * cluster. L'outcome stesso resta veicolato dal badge a destra del titolo: qui evitiamo
   * di ripeterlo a testo (`positiva`/`negativa` già visibile come pillola).
   */
  const localOrdinal =
    conversations
      .filter((c) => (c.outcome ?? 'positive') === outcome)
      .findIndex((c) => c.conversationId === active.conversationId) + 1;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-slate-800/70 bg-slate-950/85 px-4 py-2.5 flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-violet-400/90" aria-hidden />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-100/90">
          Conversazione&nbsp;
          <span className="tabular-nums">{Math.max(1, localOrdinal)}ª</span>
        </h3>
        <span
          className={
            outcome === 'positive'
              ? 'inline-flex items-center gap-1 rounded-full border border-emerald-500/45 bg-emerald-950/45 px-1.5 py-[1px] text-[10px] font-medium text-emerald-200'
              : 'inline-flex items-center gap-1 rounded-full border border-rose-500/45 bg-rose-950/45 px-1.5 py-[1px] text-[10px] font-medium text-rose-200'
          }
          title={
            outcome === 'positive'
              ? 'Conversazione che si chiude con accettazione / conferma'
              : 'Conversazione che si chiude con date esaurite o abbandono educato'
          }
        >
          {outcome === 'positive' ? <Check size={10} aria-hidden /> : <X size={10} aria-hidden />}
          {outcome === 'positive' ? 'positiva' : 'negativa'}
        </span>
        <span className="text-[11px] tracking-wide text-slate-500">
          {active.turns.length} turni
        </span>
      </header>

      {active.scenarioSummary && active.scenarioSummary.trim().length > 0 ? (
        <div
          className="shrink-0 border-b border-violet-500/20 bg-violet-950/20 px-4 py-2.5"
          aria-label="Sintesi dello scenario"
        >
          <div className="flex items-start gap-2">
            <BookOpen
              size={13}
              className="mt-[2px] shrink-0 text-violet-300/85"
              aria-hidden
            />
            <p className="min-w-0 whitespace-pre-line text-[12px] leading-relaxed text-slate-200">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
                Scenario:
              </span>
              {active.scenarioSummary}
            </p>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {active.turns.length === 0 ? (
          <p className="text-xs italic text-slate-500">
            La conversazione è vuota: l&apos;AI non ha prodotto turni. Riprova la generazione.
          </p>
        ) : (
          active.turns
            .filter((t) => {
              /*
                Filtro inclusione: nascondi le bubble agente di use case esclusi (i turni
                user non hanno appartenenza univoca, restano sempre visibili). Vedi
                {@link AIAgentUseCase.included_in_conversations}.
              */
              if (!excludedUseCaseIds || excludedUseCaseIds.size === 0) return true;
              if (t.role !== 'agent') return true;
              const ucId = (t as UseCaseGeneratorWizardTurnAgent).useCaseId;
              return !excludedUseCaseIds.has(ucId);
            })
            .map((t) => {
              const tokenized =
                showTokenized && t.role === 'agent' && tokenizedByUseCaseId
                  ? tokenizedByUseCaseId[(t as UseCaseGeneratorWizardTurnAgent).useCaseId] ?? ''
                  : '';
              return (
                <BubbleRow
                  key={t.turnId}
                  turn={t}
                  isModified={t.role === 'agent' && modifiedTurnIds.has(t.turnId)}
                  tokenizedText={tokenized || undefined}
                  onChangeText={(text) =>
                    onUpdateTurnText(active.conversationId, t.turnId, text)
                  }
                  onPromote={
                    onPromoteSuggestion
                      ? () => void onPromoteSuggestion(active.conversationId, t.turnId)
                      : undefined
                  }
                  onReject={
                    onRejectSuggestion
                      ? () => onRejectSuggestion(active.conversationId, t.turnId)
                      : undefined
                  }
                />
              );
            })
        )}
      </div>
    </div>
  );
}

function BubbleRow({
  turn,
  isModified,
  tokenizedText,
  onChangeText,
  onPromote,
  onReject,
}: {
  turn: UseCaseGeneratorWizardTurn;
  isModified: boolean;
  /** Versione tokenizzata della frase canonica (vedi prop `showTokenized` del parent). */
  tokenizedText?: string;
  onChangeText: (text: string) => void;
  onPromote?: () => void;
  onReject?: () => void;
}): React.ReactElement {
  const isUser = turn.role === 'user';
  if (isUser) {
    return <UserBubble text={turn.text} onChangeText={onChangeText} />;
  }
  const agent = turn as UseCaseGeneratorWizardTurnAgent;
  const isRejected = agent.suggestion?.status === 'rejected';
  const isPending = agent.suggestion?.status === 'pending';
  /**
   * Sfondo distintivo per bubble suggested in stato `pending`: ambra molto pallido (oltre alla
   * pillola lampadina) per renderle riconoscibili a colpo d'occhio anche in mezzo a molti turni.
   * `rejected` resta grigio neutro (suggestion già archiviata).
   */
  const bubbleSurface = isRejected
    ? 'bg-slate-900/55 text-slate-400 border border-slate-700/55 opacity-70'
    : isPending
      ? 'bg-amber-950/25 text-amber-50 border border-amber-500/30'
      : 'bg-slate-900/85 text-slate-100 border border-slate-700/85';
  /**
   * `tokenizedText` è valorizzato dal parent SOLO quando `showTokenized` è ON ed esiste un
   * tokenized per lo use case. Quando presente, la bubble proietta la versione tokenizzata
   * (read-only) al posto della frase canonica.
   */
  const showTokenInline = !!tokenizedText;

  return (
    <div className="flex w-full justify-start">
      <div
        className={[
          'flex max-w-[92%] min-w-0 gap-2 rounded-2xl px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
          bubbleSurface,
          isModified ? 'ring-1 ring-emerald-500/55' : '',
          isPending ? 'ring-1 ring-amber-400/55' : '',
        ].join(' ')}
      >
        <span
          className={isPending ? 'shrink-0 mt-[1px] text-amber-300/90' : 'shrink-0 mt-[1px] text-violet-300/85'}
          aria-hidden
        >
          <Bot size={14} />
        </span>
        <div className="min-w-0 flex-1">
          {showTokenInline ? (
            <TokenizedHighlightedText
              text={tokenizedText as string}
              className="min-h-[1rem] whitespace-pre-wrap break-words pr-1 text-xs leading-snug text-current"
              strike={isRejected}
            />
          ) : (
            <BubbleEditor
              text={agent.text}
              onChange={onChangeText}
              ariaLabel="Frase agente"
              readOnly={isRejected}
              strike={isRejected}
              title={
                isPending
                  ? 'Use case emergente in attesa: l\'edit cambia solo questa bubble fino a quando lo promuovi al catalogo.'
                  : 'Modificando questa bubble aggiorni la frase canonica dello use case: l\'edit si propaga a tutte le altre bubble collegate (in tutte le conversazioni).'
              }
            />
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {isPending ? (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-400/55 bg-amber-950/50 px-1.5 py-[1px] text-[10px] font-medium leading-tight text-amber-200"
                title={`Use case emergente proposto dall'AI: ${agent.useCaseLabel || agent.useCaseId}`}
              >
                <Lightbulb size={10} aria-hidden />
                <span className="opacity-80">Suggerito:</span>
                <span className="truncate max-w-[180px]">
                  {agent.suggestion?.proposedLabel || agent.useCaseLabel}
                </span>
              </span>
            ) : isRejected ? (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-600/70 bg-slate-900/70 px-1.5 py-[1px] text-[10px] font-medium leading-tight text-slate-400 line-through"
                title="Suggerimento scartato dal designer: la bubble è presente ma non concorre più alla revisione."
              >
                <Lightbulb size={10} aria-hidden />
                Scartato
              </span>
            ) : (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-violet-500/40 bg-violet-950/50 px-1.5 py-[1px] text-[10px] font-medium leading-tight text-violet-200/95"
                title={`Caso d'uso sorgente: ${agent.useCaseLabel || agent.useCaseId}. Modificando il testo aggiorni la frase canonica di questo caso d'uso (propagazione globale).`}
              >
                <span className="opacity-70">use case</span>
                <span className="truncate max-w-[200px]">
                  {agent.useCaseLabel || agent.useCaseId}
                </span>
              </span>
            )}
            {isModified && !isRejected ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-950/45 px-1.5 py-[1px] text-[10px] font-medium leading-tight text-emerald-200">
                modificata
              </span>
            ) : null}
            {isPending && (onPromote || onReject) ? (
              <span className="ml-auto inline-flex items-center gap-1">
                {onPromote ? (
                  <button
                    type="button"
                    onClick={onPromote}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-400/55 bg-amber-950/60 px-1.5 py-[1px] text-[10px] font-medium leading-tight text-amber-100 hover:bg-amber-900/70"
                    title="Aggiungi questo use case emergente al catalogo: crea un nuovo caso d'uso e collega la bubble."
                  >
                    <Check size={10} aria-hidden />
                    Aggiungi al catalogo
                  </button>
                ) : null}
                {onReject ? (
                  <button
                    type="button"
                    onClick={onReject}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-500/55 bg-slate-900/75 px-1.5 py-[1px] text-[10px] font-medium leading-tight text-slate-300 hover:bg-slate-800/85"
                    title="Scarta il suggerimento: la bubble resta visibile ma viene ignorata nelle azioni AI."
                  >
                    <X size={10} aria-hidden />
                    Scarta
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserBubble({
  text,
  onChangeText,
}: {
  text: string;
  onChangeText: (text: string) => void;
}): React.ReactElement {
  return (
    <div className="flex w-full justify-end">
      <div className="flex max-w-[92%] min-w-0 gap-2 rounded-2xl px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] bg-violet-900/45 text-amber-50 border border-violet-500/40">
        <span className="shrink-0 mt-[1px] text-violet-300/85" aria-hidden>
          <User size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <BubbleEditor text={text} onChange={onChangeText} ariaLabel="Frase utente" />
        </div>
      </div>
    </div>
  );
}

/**
 * Inline editor in stile «edit on demand» allineato al pattern usato altrove nel progetto
 * (es. `AIAgentUseCaseComposer` per il payoff degli use case, `EditableText` per i form):
 *
 * 1. Stato display: il testo è solo letto. In hover/focus appare la matita.
 * 2. Click sulla matita → entra in edit: textarea con focus + selezione, draft LOCALE.
 * 3. Le modifiche non vengono propagate fino al conferma → niente cross-bubble propagation
 *    finché l'utente sta digitando (evita ricalcoli a ogni keystroke).
 * 4. Conferma con Check (verde, visibile solo se cambiato) o Enter.
 * 5. Annulla con X (rosso) o Escape: draft scartato.
 * 6. Blur "neutro": NON salva e NON annulla — restiamo in edit; lo stato si chiude solo
 *    su azione esplicita (Check / X / Enter / Esc), per evitare perdite di edit accidentali.
 *
 * `readOnly` (es. suggestion `rejected`) disabilita completamente l'ingresso in edit.
 */
function BubbleEditor({
  text,
  onChange,
  ariaLabel,
  readOnly = false,
  strike = false,
  title,
}: {
  text: string;
  onChange: (text: string) => void;
  ariaLabel: string;
  readOnly?: boolean;
  strike?: boolean;
  title?: string;
}): React.ReactElement {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text);

  /**
   * Sync `draft` con `text` esterno SOLO mentre non si è in edit. Durante l'edit il valore
   * canonico può cambiare per propagazione cross-bubble: vogliamo che il draft del designer
   * resti intatto fino al confirm/cancel esplicito.
   */
  React.useEffect(() => {
    if (!isEditing) setDraft(text);
  }, [text, isEditing]);

  /** Auto-grow textarea: ricalcolo altezza in edit a ogni cambio di draft. */
  React.useEffect(() => {
    if (!isEditing) return;
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [draft, isEditing]);

  React.useEffect(() => {
    if (!isEditing) return;
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, [isEditing]);

  const enterEdit = React.useCallback(() => {
    if (readOnly) return;
    setDraft(text);
    setIsEditing(true);
  }, [readOnly, text]);

  const cancelEdit = React.useCallback(() => {
    setDraft(text);
    setIsEditing(false);
  }, [text]);

  const commitEdit = React.useCallback(() => {
    const next = draft;
    setIsEditing(false);
    if (next !== text) onChange(next);
  }, [draft, text, onChange]);

  if (!isEditing) {
    return (
      <div className="group relative min-w-0" title={title}>
        <p
          className={[
            'min-h-[1rem] whitespace-pre-wrap break-words pr-7 text-xs leading-snug text-current',
            strike ? 'line-through' : '',
            readOnly ? 'cursor-not-allowed' : '',
          ].join(' ')}
          aria-label={ariaLabel}
        >
          {text}
        </p>
        {!readOnly ? (
          <button
            type="button"
            aria-label={`Modifica ${ariaLabel.toLowerCase()}`}
            onClick={enterEdit}
            className="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-md border border-violet-400/35 bg-slate-950/80 text-violet-200 opacity-0 shadow-sm transition-opacity hover:bg-violet-950/80 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80 group-hover:opacity-100 group-focus-within:opacity-100"
            title="Modifica questa bubble"
          >
            <Pencil size={11} aria-hidden />
          </button>
        ) : null}
      </div>
    );
  }

  const hasChanged = draft !== text;
  return (
    <div className="flex w-full items-start gap-1">
      <textarea
        ref={ref}
        value={draft}
        aria-label={ariaLabel}
        spellCheck
        title={title}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commitEdit();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
          }
        }}
        className={[
          'block w-full resize-none rounded-md border border-violet-500/45 bg-slate-950/55 px-1.5 py-0.5 text-xs leading-snug text-current focus:outline-none focus:ring-1 focus:ring-violet-500/70 m-0 align-middle',
          strike ? 'line-through' : '',
        ].join(' ')}
        rows={1}
      />
      <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
        <button
          type="button"
          disabled={!hasChanged}
          onMouseDown={(e) => e.preventDefault()}
          onClick={commitEdit}
          className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40 disabled:hover:bg-transparent"
          title="Conferma (Enter)"
          aria-label="Conferma modifica"
        >
          <Check size={14} aria-hidden />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancelEdit}
          className="rounded p-0.5 text-rose-400 hover:bg-slate-800/90"
          title="Annulla (Esc)"
          aria-label="Annulla modifica"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
