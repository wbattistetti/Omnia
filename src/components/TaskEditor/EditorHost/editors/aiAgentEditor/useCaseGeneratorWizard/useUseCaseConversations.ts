/**
 * Stato passo «Conversazioni» del wizard use case (passo 2).
 *
 * Responsabilità:
 * - array conversazioni, conversazione attiva
 * - baseline AI per bubble agente
 * - plan diff per CTA proofread/propaga-stile
 * - propagazione di edit bubble agente: vedere {@link propagateAgentTextToAllBubblesForUseCase}
 * - lifecycle suggestion: pending → promoted | rejected
 *
 * I parametri di creazione (outcome / lampadina) non sono persistiti come stato locale:
 * vengono passati di volta in volta dal pulsante del pannello DX a `runAssembleConversation`.
 *
 * Storia: in passato esisteva un toggle Riga 2 «Mostra usecases / Mostra conversazioni»
 * (`conversationsView`) per alternare la vista sinistra tra lista use case (read-only) e
 * bubble chat. Il toggle è stato rimosso perché ridondante con lo stepper della pipeline
 * (1. Casi d'uso → 2. Conversazioni → 3. Tokenizzazione): se il designer vuole rivedere la
 * lista clicca lo step 1. Il campo `conversationsView` resta accettato in lettura dai
 * payload persistiti per backward-compat ma non è più scrivibile, e la vista del Passo 2
 * è sempre la bubble chat.
 *
 * Persistenza: tutti questi campi sono serializzati nel payload del wizard tramite
 * {@link useCaseWizardPersistedState}. L'hook pubblica gli stati raw (per il payload) e
 * un epoch incrementato a ogni mutazione di baseline (per ricompilare il piano).
 */

import React from 'react';
import {
  computeConversationStylePlan,
  conversationAgentTurnKey,
  indexAgentTurnKeysByUseCaseId,
  snapshotConversationAgentTurns,
  snapshotConversationAgentTurnsForKeys,
  type ConversationStylePlan,
} from '@domain/useCaseGeneratorWizard/conversationsBaseline';
import type {
  UseCaseGeneratorWizardConversation,
  UseCaseGeneratorWizardTurnAgent,
  UseCaseGeneratorWizardTurnSuggestionStatus,
} from '@domain/useCaseGeneratorWizard/types';
import { isSuggestedUseCaseId } from '@domain/useCaseGeneratorWizard/types';

const EMPTY_PLAN: ConversationStylePlan = {
  modifiedAgentTurnKeys: [],
  modifiedByConversation: {},
  modifiedAgentTurns: [],
  unmodifiedByConversation: {},
  showProofreadCta: false,
  showStyleCta: false,
  showHomogenizeCta: false,
};

export interface UseUseCaseConversationsModel {
  conversations: UseCaseGeneratorWizardConversation[];
  activeConversationId: string | null;
  conversationAgentBaselineByKey: Record<string, string>;
  conversationStylePlan: ConversationStylePlan;
  hasConversations: boolean;
  setActiveConversationId: (id: string | null) => void;
  /** Append + auto-select; lancia se l'id collide (bug del chiamante). */
  appendConversation: (conversation: UseCaseGeneratorWizardConversation) => void;
  /**
   * Edit testo bubble.
   * - user turn: cambia solo localmente.
   * - agent turn con suggestion `pending`: cambia solo la bubble (testo locale, no canonico).
   * - agent turn con suggestion `rejected`: ignorato (bubble bloccata).
   * - agent turn reale (no `suggestion`): aggiorna il testo IN TUTTE le bubble dello stesso useCaseId
   *   in TUTTE le conversazioni (filosofia bubble = vista del canonico) e aggiorna la baseline AI
   *   delle bubble propagate per non farle apparire come «modificate».
   *   La sincronizzazione del canonico nel catalogo `useCases` viene fatta a monte tramite il callback
   *   {@link UseUseCaseConversationsParams.onAgentCanonicalTextChange}.
   */
  updateConversationTurnText: (
    conversationId: string,
    turnId: string,
    text: string
  ) => void;
  /** Sostituisce in blocco una conversazione (es. dopo proofread AI). */
  replaceConversation: (conversation: UseCaseGeneratorWizardConversation) => void;
  /** Aggiorna baseline AI con lo snapshot corrente delle bubble agente. */
  captureConversationsBaseline: (
    conversations?: readonly UseCaseGeneratorWizardConversation[]
  ) => void;
  /**
   * Sincronizza il testo delle bubble agente con la frase canonica corrente dello use case.
   * Da chiamare dopo edit canonical fuori dal pannello conversazioni (es. composer Passo 1
   * o «Propaga stile» applicato agli use case). Aggiorna anche la baseline per le bubble toccate.
   */
  syncBubblesToCanonicalText: (
    canonicalByUseCaseId: Readonly<Record<string, string>>
  ) => void;
  /** Promuove la suggestion di una bubble a use case reale (id del catalogo appena creato). */
  promoteSuggestionToCanonical: (
    conversationId: string,
    turnId: string,
    promotedUseCaseId: string,
    promotedLabel: string
  ) => void;
  /** Imposta lo stato della suggestion (oggi: rejected). */
  setSuggestionStatus: (
    conversationId: string,
    turnId: string,
    status: UseCaseGeneratorWizardTurnSuggestionStatus
  ) => void;
  /**
   * Azzeramento totale (Clear All): conversazioni, view, baselines, attivo. Usato dal toolbar
   * «Pulisci tutto» del wizard. NON notifica `onChange` (lo fa il chiamante a livello superiore).
   */
  resetAll: () => void;
}

export interface UseUseCaseConversationsParams {
  /** Idratazione iniziale dal payload persistito. */
  initialConversations?: readonly UseCaseGeneratorWizardConversation[];
  initialActiveConversationId?: string | null;
  initialBaselineByKey?: Readonly<Record<string, string>>;
  /** Notifica il wizard di marcare lo stato come dirty per la persistenza. */
  onChange?: () => void;
  /**
   * Edit di una bubble agente REALE → effetto laterale sul catalogo:
   * aggiornare la frase canonica dello use case (`agentExample`). Senza questo callback la
   * propagazione cross-conversazione funziona ma il catalogo Step 1 resta de-sincronizzato.
   */
  onAgentCanonicalTextChange?: (useCaseId: string, text: string) => void;
}

export function useUseCaseConversations(params: UseUseCaseConversationsParams): UseUseCaseConversationsModel {
  const { onChange, onAgentCanonicalTextChange } = params;

  const [conversations, setConversations] = React.useState<UseCaseGeneratorWizardConversation[]>(
    () => [...(params.initialConversations ?? [])]
  );
  const [activeConversationId, setActiveConversationIdState] = React.useState<string | null>(
    params.initialActiveConversationId ?? null
  );
  const baselineRef = React.useRef<Record<string, string>>({
    ...(params.initialBaselineByKey ?? {}),
  });
  const [baselineEpoch, setBaselineEpoch] = React.useState(0);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const onAgentCanonicalTextChangeRef = React.useRef(onAgentCanonicalTextChange);
  onAgentCanonicalTextChangeRef.current = onAgentCanonicalTextChange;
  const markDirty = React.useCallback(() => {
    onChangeRef.current?.();
  }, []);

  /**
   * Idratazione successiva (cambio task / hydrate da legacy): se le prop iniziali cambiano
   * reference E contenuto, riallinea lo state interno.
   *
   * Premessa importante: il parent (`useUseCaseGeneratorWizard`) memoizza il payload parsed
   * con una cache stabile (vedi `initialConvHydratedCacheRef`), così `params.initial*` non
   * cambiano reference per il semplice echo locale persist→prop. Quando *cambiano* reference,
   * è un vero cambio di task o un'hydrate da legacy, e qui dobbiamo allineare.
   *
   * Guard di contenuto: se signature del payload in ingresso === ultimo signature applicato,
   * no-op (difesa in più contro reference-change senza content-change residui).
   */
  /**
   * Inizializzata al mount alla signature dei `params.initial*` per evitare un run iniziale
   * dell'effect di riallineamento che sovrascrive lo state appena costruito dagli stessi
   * params (bump epoch + setConversations spuri sul primo render).
   */
  const lastHydratedSignatureRef = React.useRef<string>(
    JSON.stringify({
      c: params.initialConversations ?? null,
      a: params.initialActiveConversationId ?? null,
      b: params.initialBaselineByKey ?? null,
    })
  );
  React.useEffect(() => {
    const signature = JSON.stringify({
      c: params.initialConversations ?? null,
      a: params.initialActiveConversationId ?? null,
      b: params.initialBaselineByKey ?? null,
    });
    if (signature === lastHydratedSignatureRef.current) return;
    lastHydratedSignatureRef.current = signature;

    setConversations([...(params.initialConversations ?? [])]);
    setActiveConversationIdState(params.initialActiveConversationId ?? null);
    baselineRef.current = { ...(params.initialBaselineByKey ?? {}) };
    setBaselineEpoch((n) => n + 1);
  }, [
    params.initialConversations,
    params.initialActiveConversationId,
    params.initialBaselineByKey,
  ]);

  const setActiveConversationId = React.useCallback(
    (id: string | null) => {
      setActiveConversationIdState((prev) => {
        if (prev === id) return prev;
        markDirty();
        return id;
      });
    },
    [markDirty]
  );

  const appendConversation = React.useCallback(
    (conversation: UseCaseGeneratorWizardConversation) => {
      if (!conversation || typeof conversation.conversationId !== 'string' || !conversation.conversationId.trim()) {
        throw new Error('appendConversation: conversationId mancante.');
      }
      setConversations((prev) => {
        if (prev.some((c) => c.conversationId === conversation.conversationId)) {
          /**
           * Fail Early: l'id deve essere univoco. Se collide è un bug del chiamante
           * (es. caller che riusa l'id del modello LLM invece di rigenerarlo lato client).
           */
          throw new Error(
            `appendConversation: conversationId duplicato "${conversation.conversationId}". L'id va generato lato client per ogni conversazione.`
          );
        }
        return [...prev, conversation];
      });
      setActiveConversationIdState(conversation.conversationId);
      markDirty();
    },
    [markDirty]
  );

  const replaceConversation = React.useCallback(
    (conversation: UseCaseGeneratorWizardConversation) => {
      if (!conversation || !conversation.conversationId) {
        throw new Error('replaceConversation: conversationId mancante.');
      }
      setConversations((prev) =>
        prev.map((c) => (c.conversationId === conversation.conversationId ? conversation : c))
      );
      markDirty();
    },
    [markDirty]
  );

  const updateConversationTurnText = React.useCallback(
    (conversationId: string, turnId: string, text: string) => {
      /**
       * Tre rami:
       *  1) user turn → modifica locale.
       *  2) agent turn con suggestion `pending` → modifica locale del solo testo della bubble.
       *  3) agent turn con suggestion `rejected` → ignorato (bubble bloccata).
       *  4) agent turn reale → propagazione cross-bubble + sync canonico esterno.
       */
      let targetIsRealAgent = false;
      let targetUseCaseId: string | null = null;
      let conversationsAfter: UseCaseGeneratorWizardConversation[] | null = null;

      setConversations((prev) => {
        const next = prev.map((c) => {
          if (c.conversationId !== conversationId) return c;
          let mutated = false;
          const turns = c.turns.map((t) => {
            if (t.turnId !== turnId) return t;
            if (t.role === 'user') {
              if (t.text === text) return t;
              mutated = true;
              return { ...t, text };
            }
            const agent = t as UseCaseGeneratorWizardTurnAgent;
            if (agent.suggestion?.status === 'rejected') {
              /** Bubble scartata: edit ignorato. */
              return t;
            }
            if (agent.suggestion?.status === 'pending') {
              if (agent.text === text) return t;
              mutated = true;
              return { ...agent, text };
            }
            /** Agent reale → propagazione cross-bubble fuori da questo branch (ramo 4). */
            targetIsRealAgent = true;
            targetUseCaseId = agent.useCaseId;
            if (agent.text === text) return t;
            mutated = true;
            return { ...agent, text };
          });
          if (!mutated) return c;
          return { ...c, turns };
        });
        if (!targetIsRealAgent) {
          conversationsAfter = next;
          return next;
        }
        /** Propagazione: aggiorna tutte le bubble agente con stesso useCaseId in ogni conversazione. */
        const ucId = targetUseCaseId!;
        const finalConversations = next.map((c) => {
          let mutated = false;
          const turns = c.turns.map((t) => {
            if (t.role !== 'agent') return t;
            const agent = t as UseCaseGeneratorWizardTurnAgent;
            if (agent.useCaseId !== ucId) return t;
            if (agent.suggestion?.status === 'rejected') return t;
            if (agent.text === text) return t;
            mutated = true;
            return { ...agent, text };
          });
          if (!mutated) return c;
          return { ...c, turns };
        });
        conversationsAfter = finalConversations;
        return finalConversations;
      });

      /**
       * Cast esplicito: TypeScript non vede l'assegnazione di `conversationsAfter` nel callback
       * di `setConversations` (closure analysis conservativa) e lo narrowa a `null`. Il flusso
       * runtime garantisce che `conversationsAfter` sia popolato dopo `setConversations`.
       */
      const conversationsAfterList = conversationsAfter as
        | UseCaseGeneratorWizardConversation[]
        | null;
      if (targetIsRealAgent && targetUseCaseId && conversationsAfterList) {
        /** Aggiorna baseline solo per le bubble propagate (no false positivi in style plan). */
        const ucIdNonNull = targetUseCaseId;
        const keysToRefresh = new Set<string>();
        for (const c of conversationsAfterList) {
          for (const t of c.turns) {
            if (t.role !== 'agent') continue;
            const agent = t as UseCaseGeneratorWizardTurnAgent;
            if (agent.useCaseId !== ucIdNonNull) continue;
            if (agent.suggestion?.status === 'rejected') continue;
            keysToRefresh.add(conversationAgentTurnKey(c.conversationId, agent.turnId));
          }
        }
        baselineRef.current = snapshotConversationAgentTurnsForKeys(
          conversationsAfterList,
          baselineRef.current,
          keysToRefresh
        );
        setBaselineEpoch((n) => n + 1);
        /** Side effect verso il catalogo: sincronizza la frase canonica dello use case. */
        onAgentCanonicalTextChangeRef.current?.(ucIdNonNull, text);
      }
      markDirty();
    },
    [markDirty]
  );

  const captureConversationsBaseline = React.useCallback(
    (target?: readonly UseCaseGeneratorWizardConversation[]) => {
      const source = target ?? conversations;
      baselineRef.current = snapshotConversationAgentTurns(source);
      setBaselineEpoch((n) => n + 1);
      markDirty();
    },
    [conversations, markDirty]
  );

  const syncBubblesToCanonicalText = React.useCallback(
    (canonicalByUseCaseId: Readonly<Record<string, string>>) => {
      let anyChanged = false;
      let conversationsAfter: UseCaseGeneratorWizardConversation[] | null = null;
      setConversations((prev) => {
        const next = prev.map((c) => {
          let mutated = false;
          const turns = c.turns.map((t) => {
            if (t.role !== 'agent') return t;
            const agent = t as UseCaseGeneratorWizardTurnAgent;
            if (isSuggestedUseCaseId(agent.useCaseId)) return t;
            const canonical = canonicalByUseCaseId[agent.useCaseId];
            if (typeof canonical !== 'string') return t;
            if (agent.text === canonical) return t;
            mutated = true;
            return { ...agent, text: canonical };
          });
          if (!mutated) return c;
          anyChanged = true;
          return { ...c, turns };
        });
        conversationsAfter = next;
        return next;
      });
      /** Cast esplicito: vedi nota in `applyTurnEdit`. */
      const conversationsAfterList = conversationsAfter as
        | UseCaseGeneratorWizardConversation[]
        | null;
      if (!anyChanged || !conversationsAfterList) return;
      /** Allinea baseline a posteriori per non vedere "modificate" le bubble appena sincronizzate. */
      const idsToRefresh = new Set(Object.keys(canonicalByUseCaseId));
      const keysToRefresh = new Set<string>();
      for (const c of conversationsAfterList) {
        for (const t of c.turns) {
          if (t.role !== 'agent') continue;
          const agent = t as UseCaseGeneratorWizardTurnAgent;
          if (!idsToRefresh.has(agent.useCaseId)) continue;
          if (agent.suggestion?.status === 'rejected') continue;
          keysToRefresh.add(conversationAgentTurnKey(c.conversationId, agent.turnId));
        }
      }
      baselineRef.current = snapshotConversationAgentTurnsForKeys(
        conversationsAfterList,
        baselineRef.current,
        keysToRefresh
      );
      setBaselineEpoch((n) => n + 1);
      markDirty();
    },
    [markDirty]
  );

  const promoteSuggestionToCanonical = React.useCallback(
    (conversationId: string, turnId: string, promotedUseCaseId: string, promotedLabel: string) => {
      if (!promotedUseCaseId || isSuggestedUseCaseId(promotedUseCaseId)) {
        throw new Error('promoteSuggestionToCanonical: promotedUseCaseId deve essere un id reale.');
      }
      let conversationsAfter: UseCaseGeneratorWizardConversation[] | null = null;
      setConversations((prev) => {
        const next = prev.map((c) => {
          if (c.conversationId !== conversationId) return c;
          let mutated = false;
          const turns = c.turns.map((t) => {
            if (t.turnId !== turnId) return t;
            if (t.role !== 'agent') return t;
            const agent = t as UseCaseGeneratorWizardTurnAgent;
            if (!agent.suggestion || agent.suggestion.status !== 'pending') return t;
            mutated = true;
            const rest: UseCaseGeneratorWizardTurnAgent = { ...agent };
            delete (rest as { suggestion?: unknown }).suggestion;
            return {
              ...rest,
              useCaseId: promotedUseCaseId,
              useCaseLabel: promotedLabel,
            };
          });
          if (!mutated) return c;
          return { ...c, turns };
        });
        conversationsAfter = next;
        return next;
      });
      if (!conversationsAfter) return;
      /**
       * Dopo la promozione la bubble diventa una vista del nuovo canonico: ne capturiamo la
       * baseline così non risulta «modificata» dal primo render successivo.
       */
      const key = conversationAgentTurnKey(conversationId, turnId);
      baselineRef.current = snapshotConversationAgentTurnsForKeys(
        conversationsAfter,
        baselineRef.current,
        new Set([key])
      );
      setBaselineEpoch((n) => n + 1);
      markDirty();
    },
    [markDirty]
  );

  const setSuggestionStatus = React.useCallback(
    (conversationId: string, turnId: string, status: UseCaseGeneratorWizardTurnSuggestionStatus) => {
      if (status === 'promoted') {
        throw new Error(
          'setSuggestionStatus: usa promoteSuggestionToCanonical per la promozione (richiede id catalogo).'
        );
      }
      setConversations((prev) =>
        prev.map((c) => {
          if (c.conversationId !== conversationId) return c;
          let mutated = false;
          const turns = c.turns.map((t) => {
            if (t.turnId !== turnId) return t;
            if (t.role !== 'agent') return t;
            const agent = t as UseCaseGeneratorWizardTurnAgent;
            if (!agent.suggestion) return t;
            if (agent.suggestion.status === status) return t;
            mutated = true;
            return {
              ...agent,
              suggestion: { ...agent.suggestion, status },
            };
          });
          if (!mutated) return c;
          return { ...c, turns };
        })
      );
      markDirty();
    },
    [markDirty]
  );

  /** Backfill: bubble agente create dall'AI ma ancora senza baseline → snapshot del testo iniziale. */
  React.useEffect(() => {
    if (conversations.length === 0) return;
    let changed = false;
    const base = baselineRef.current;
    for (const c of conversations) {
      for (const t of c.turns) {
        if (t.role !== 'agent') continue;
        const key = conversationAgentTurnKey(c.conversationId, t.turnId);
        if (base[key] === undefined) {
          base[key] = t.text;
          changed = true;
        }
      }
    }
    if (changed) setBaselineEpoch((n) => n + 1);
  }, [conversations]);

  /** Auto-correzione activeConversationId: se l'id non esiste più (es. dopo reset). */
  React.useEffect(() => {
    if (activeConversationId === null) return;
    if (conversations.some((c) => c.conversationId === activeConversationId)) return;
    setActiveConversationIdState(conversations.length > 0 ? conversations[0].conversationId : null);
  }, [conversations, activeConversationId]);

  const conversationStylePlan = React.useMemo<ConversationStylePlan>(() => {
    if (conversations.length === 0) return EMPTY_PLAN;
    return computeConversationStylePlan(conversations, baselineRef.current);
    /** `baselineEpoch` è una dipendenza intenzionale: la baseline è mutata in-place via ref. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, baselineEpoch]);

  /** Reference immutabile per dependency lists del wizard (cambia ogni `baselineEpoch`). */
  const conversationAgentBaselineByKey = React.useMemo<Record<string, string>>(
    () => ({ ...baselineRef.current }),
    /** `baselineEpoch` è una dipendenza intenzionale: la baseline è mutata in-place via ref. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baselineEpoch]
  );

  /**
   * Reset totale: rimuove tutte le conversazioni, baseline, conversation attiva, riporta la
   * view al default. Pensato per «Pulisci tutto» del wizard: non chiama `markDirty` perché
   * il chiamante orchestratore (livello superiore) gestisce la persistenza del nuovo stato.
   */
  const resetAll = React.useCallback(() => {
    baselineRef.current = {};
    lastHydratedSignatureRef.current = '';
    setConversations([]);
    setActiveConversationIdState(null);
    setBaselineEpoch((n) => n + 1);
  }, []);

  // Pre-calcolato per uso futuro lato consumer (es. azioni di propagazione stile per conv attiva).
  // Non incluso nell'oggetto di ritorno: viene ricomputato on-demand dai consumer.
  void indexAgentTurnKeysByUseCaseId;

  return {
    conversations,
    activeConversationId,
    conversationAgentBaselineByKey,
    conversationStylePlan,
    hasConversations: conversations.length > 0,
    setActiveConversationId,
    appendConversation,
    updateConversationTurnText,
    replaceConversation,
    captureConversationsBaseline,
    syncBubblesToCanonicalText,
    promoteSuggestionToCanonical,
    setSuggestionStatus,
    resetAll,
  };
}
