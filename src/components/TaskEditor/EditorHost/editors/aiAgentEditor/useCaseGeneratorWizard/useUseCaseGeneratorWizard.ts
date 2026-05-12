/**
 * Lightweight pipeline state for the guided use-case generator: step index, IA baselines, sequential unlock.
 * Stato pipeline + baseline persistiti sul Task (`agentUseCaseWizardStateJson`).
 */

import React from 'react';
import { USE_CASE_GENERATOR_WIZARD_STEP_ORDER } from '@domain/useCaseGeneratorWizard/registry';
import { getUseCaseGeneratorWizardStepConfig } from '@domain/useCaseGeneratorWizard/config';
import { serializeUseCaseListForWizardBaseline } from '@domain/useCaseGeneratorWizard/useCaseListBaseline';
import {
  computeExamplePhraseStylePlan,
  snapshotAssistantContentByUseCaseId,
  type ExamplePhraseStylePlan,
} from '@domain/useCaseGeneratorWizard/examplePhraseStyleDiff';
import type { ConversationStylePlan } from '@domain/useCaseGeneratorWizard/conversationsBaseline';
import {
  parseUseCaseWizardPersistedState,
  serializeUseCaseWizardPersistedState,
  USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
  type UseCaseWizardPersistedStateV1,
} from '@domain/useCaseGeneratorWizard/useCaseWizardPersistedState';
import type {
  UseCaseGeneratorWizardConversation,
  UseCaseGeneratorWizardStepId,
  UseCaseGeneratorWizardTurnSuggestionStatus,
} from '@domain/useCaseGeneratorWizard/types';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { useUseCaseConversations } from './useUseCaseConversations';

const LAST_STEP_INDEX = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length - 1;
const USE_CASE_LIST_STEP_INDEX = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.indexOf('use_case_list');
const CONVERSATIONS_STEP_INDEX = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.indexOf('conversations');

/** Passo lista: confronto frasi assistente vs baseline (stile / omogeneizza). */
function isExamplePhraseStyleStep(stepIndex: number): boolean {
  return stepIndex === USE_CASE_LIST_STEP_INDEX;
}

const EMPTY_EXAMPLE_PHRASE_PLAN: ExamplePhraseStylePlan = {
  modifiedIds: [],
  unmodifiedIds: [],
  targetIds: [],
  showStyleCta: false,
};

export interface UseUseCaseGeneratorWizardParams {
  instanceId: string | undefined;
  useCases: readonly AIAgentUseCase[];
  /** JSON dal Task — ripristino dopo salvataggio progetto. */
  taskPersistedWizardJson?: string | null;
  /** Persistenza sul Task (debounced via controller `dirty`). */
  onWizardPersist?: (json: string) => void;
  onConfirmAdvanceWithoutEdits?: (stepId: UseCaseGeneratorWizardStepId) => void;
  /**
   * Edit di una bubble agente reale: il wizard propaga in-place a tutte le bubble dello stesso
   * use case e notifica qui all'esterno per aggiornare il canonico (`agentExample`).
   * Senza questo callback la propagazione cross-conversazione funziona ma il catalogo Step 1
   * non si sincronizza.
   */
  onAgentCanonicalTextChange?: (useCaseId: string, text: string) => void;
  /**
   * Passo 3 wizard: edit del campo `assistant_example_tokenized` di uno use case (riga inline
   * nel pannello tokenizzazione). Il wizard mantiene la baseline AI in memoria per il diff
   * `≥ 1 edit manuale`; il setter sulla lista use case vive esternamente.
   */
  onUseCaseTokenizedTextChange?: (useCaseId: string, tokenizedText: string) => void;
}

export interface UseCaseGeneratorWizardModel {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  stepIndex: number;
  stepCount: number;
  currentStepId: UseCaseGeneratorWizardStepId;
  title: string;
  instruction: string;
  tutorialIfNoChanges: string;
  showNoChangesTutorial: boolean;
  dismissNoChangesTutorial: () => void;
  unlockedMaxStepIndex: number;
  canSelectStep: (index: number) => boolean;
  selectStep: (index: number) => void;
  goToPreviousStep: () => void;
  advanceToNextStep: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  hasEditsSinceLastAi: boolean;
  captureUseCaseListAiBaseline: (ucs?: readonly AIAgentUseCase[]) => void;
  captureExamplePhrasesBaseline: (ucs?: readonly AIAgentUseCase[]) => void;
  examplePhraseStylePlan: ExamplePhraseStylePlan;
  dialogOpen: boolean;
  dialogMessage: string;
  confirmAdvanceDialog: () => void;
  cancelAdvanceDialog: () => void;
  /** Passo 2 — stato conversazioni montate dall'AI. */
  conversations: UseCaseGeneratorWizardConversation[];
  activeConversationId: string | null;
  conversationStylePlan: ConversationStylePlan;
  setActiveConversationId: (id: string | null) => void;
  appendConversation: (conversation: UseCaseGeneratorWizardConversation) => void;
  updateConversationTurnText: (conversationId: string, turnId: string, text: string) => void;
  replaceConversation: (conversation: UseCaseGeneratorWizardConversation) => void;
  captureConversationsBaseline: (
    conversations?: readonly UseCaseGeneratorWizardConversation[]
  ) => void;
  /** Propaga ai bubble agente reali la frase canonica corrente (sync post-edit del catalogo). */
  syncBubblesToCanonicalText: (
    canonicalByUseCaseId: Readonly<Record<string, string>>
  ) => void;
  /** Promuove la suggestion `pending` di una bubble a use case reale (id catalogo). */
  promoteSuggestionToCanonical: (
    conversationId: string,
    turnId: string,
    promotedUseCaseId: string,
    promotedLabel: string
  ) => void;
  /** Imposta lo stato della suggestion (oggi usato per `rejected`). */
  setSuggestionStatus: (
    conversationId: string,
    turnId: string,
    status: UseCaseGeneratorWizardTurnSuggestionStatus
  ) => void;
  /**
   * Passo 2 — toggle checkbox Riga 2 «Mostra tokenizzazione»: quando true, ogni bubble agente
   * mostra (sotto al testo normale) la sua versione tokenizzata `assistant_example_tokenized`
   * se presente. Stato puramente di vista, non persistito.
   */
  showTokenizedInBubbles: boolean;
  toggleShowTokenizedInBubbles: () => void;
  /**
   * Passo 1 — toggle Riga 2 «Mostra JSON» (lista use case): quando true, il pannello DX viene
   * sostituito da {@link ConversationalJsonPanel} che mostra in sola lettura il JSON
   * conversazionale dello use case selezionato. Stato di vista on-demand, NON persistito:
   * memory-only, default false a ogni mount del wizard.
   *
   * Vincoli di visibilità del toggle (gestiti dal call-site, non dal wizard):
   *  - siamo allo step `use_case_list`
   *  - `useCases.length > 0`
   *  - almeno uno use case ha `assistant_example_tokenized` non vuoto
   *  - uno use case è selezionato (necessario per il panel; il toggle resta visibile ma
   *    il panel mostra lo stato vuoto)
   */
  showJsonPanel: boolean;
  toggleShowJsonPanel: () => void;
  /**
   * Passo 3 — cattura come baseline AI lo stato corrente di `assistant_example_tokenized` per
   * gli use case forniti. Tipicamente invocata dopo una generazione AI riuscita.
   */
  captureTokenizationAiBaseline: (ucs?: readonly AIAgentUseCase[]) => void;
  /**
   * Passo 3 — setter inline per la frase tokenizzata di un singolo use case. Il wizard
   * notifica `onUseCaseTokenizedTextChange` per applicare la modifica al modello esterno;
   * la baseline AI in memoria NON viene toccata (resta la baseline = AI), così il diff
   * `hasEditsSinceLastAi` si attiva.
   */
  setUseCaseTokenizedText: (useCaseId: string, tokenizedText: string) => void;
  /**
   * Passo 3 — mappa `useCaseId → diff status`: true se la tokenizzazione corrente differisce
   * dalla baseline AI catturata (edit manuale rilevato). Utile alla UI per evidenziare le
   * frasi modificate / abilitare CTA.
   */
  tokenizationDiffByUseCaseId: Readonly<Record<string, boolean>>;
  /** Passo 2 — reset contestuale: rimuove conversazioni e baseline, senza toccare use case/tokenizzazione. */
  resetConversations: () => void;
  /** Passo 3 — reset contestuale: rimuove solo baseline/diff della tokenizzazione nel wizard. */
  resetTokenization: () => void;
  /**
   * «Pulisci tutto»: azzera step index, unlocked max, tutte le baseline (use_case_list,
   * frasi assistente, tokenizzazione) e l'intero stato delle conversazioni in memoria.
   * Lascia immutati `enabled` e i parametri esterni (use cases, design description). Il
   * chiamante orchestratore (`AIAgentEditor`) si occupa di azzerare anche gli use case, i
   * logical steps, il runtime compact json e la chiave sessionStorage del wizard.
   */
  resetAll: () => void;
}

function storageKeyFor(instanceId: string | undefined): string | null {
  const id = instanceId?.trim();
  return id ? `omnia.useCaseGeneratorWizard.${id}` : null;
}

interface WizardConversationsSnapshot {
  conversations: readonly UseCaseGeneratorWizardConversation[];
  activeConversationId: string | null;
  conversationAgentBaselineByKey: Readonly<Record<string, string>>;
}

function buildWizardPayload(
  enabled: boolean,
  stepIndex: number,
  unlockedMaxStepIndex: number,
  baselineRef: React.MutableRefObject<Partial<Record<UseCaseGeneratorWizardStepId, string>>>,
  phraseBaselineRef: React.MutableRefObject<Record<string, string>>,
  tokenizationBaselineRef: React.MutableRefObject<Record<string, string>>,
  conv: WizardConversationsSnapshot
): UseCaseWizardPersistedStateV1 {
  const listBl = baselineRef.current.use_case_list;
  const phrase = phraseBaselineRef.current;
  const tokenization = tokenizationBaselineRef.current;
  const convBaselineKeys = Object.keys(conv.conversationAgentBaselineByKey);
  return {
    schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
    enabled,
    stepIndex,
    unlockedMaxStepIndex,
    ...(listBl !== undefined ? { useCaseListBaseline: listBl } : {}),
    ...(Object.keys(phrase).length > 0 ? { examplePhraseBaselineById: { ...phrase } } : {}),
    ...(conv.conversations.length > 0 ? { conversations: [...conv.conversations] } : {}),
    ...(conv.activeConversationId ? { activeConversationId: conv.activeConversationId } : {}),
    ...(convBaselineKeys.length > 0
      ? { conversationAgentBaselineByKey: { ...conv.conversationAgentBaselineByKey } }
      : {}),
    ...(Object.keys(tokenization).length > 0
      ? { tokenizationBaselineByUseCaseId: { ...tokenization } }
      : {}),
  };
}

export function useUseCaseGeneratorWizard({
  instanceId,
  useCases,
  taskPersistedWizardJson,
  onWizardPersist,
  onConfirmAdvanceWithoutEdits,
  onAgentCanonicalTextChange,
  onUseCaseTokenizedTextChange,
}: UseUseCaseGeneratorWizardParams): UseCaseGeneratorWizardModel {
  const key = React.useMemo(() => storageKeyFor(instanceId), [instanceId]);

  const [enabled, setEnabledState] = React.useState(true);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [unlockedMaxStepIndex, setUnlockedMaxStepIndex] = React.useState(0);
  const [baselineEpoch, setBaselineEpoch] = React.useState(0);
  const [showNoChangesTutorial, setShowNoChangesTutorial] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [examplePhraseBaselineEpoch, setExamplePhraseBaselineEpoch] = React.useState(0);
  const [tokenizationBaselineEpoch, setTokenizationBaselineEpoch] = React.useState(0);
  /**
   * Stato di vista (NON persistito): Passo 2 — quando true, le bubble agente mostrano sotto
   * la frase normale la versione tokenizzata (`assistant_example_tokenized`) se presente.
   */
  const [showTokenizedInBubbles, setShowTokenizedInBubbles] = React.useState(false);
  /**
   * Stato di vista (NON persistito): Passo 1 — toggle «Mostra JSON» nella toolbar lista.
   * Rendering del pannello DX sostituito dal preview JSON conversazionale dello use case
   * selezionato. Default false a ogni mount, coerente con la natura «on-demand» dell'azione.
   */
  const [showJsonPanel, setShowJsonPanel] = React.useState(false);

  const baselineRef = React.useRef<Partial<Record<UseCaseGeneratorWizardStepId, string>>>({});
  const examplePhraseBaselineByIdRef = React.useRef<Record<string, string>>({});
  /**
   * Baseline AI per il passo 3 «Tokenizzazione»: mappa `useCaseId → assistant_example_tokenized`
   * con la versione prodotta dall'ultima generazione AI. Il diff `hasEditsSinceLastAi` per lo
   * step 3 confronta i valori correnti su `useCases` vs questa baseline.
   */
  const tokenizationBaselineByUseCaseIdRef = React.useRef<Record<string, string>>({});
  const lastEmittedJsonRef = React.useRef<string>('');
  /**
   * Raw JSON dell'ultimo payload effettivamente idratato (non normalizzato). Serve come guard
   * idempotente del `useLayoutEffect` di hydrate: anche se i setState messi in coda dall'hydrate
   * non sono ancora flushed, un re-run dell'effetto sullo stesso `raw` deve essere no-op.
   * Senza questo guard, qualunque differenza tra `raw` e `lastEmittedJsonRef` (es. ordering chiavi,
   * formattazione) può triggerare un loop hydrate→persist→hydrate.
   */
  const lastHydratedRawRef = React.useRef<string>('');
  const prevInstanceIdRef = React.useRef<string | undefined>(undefined);

  /**
   * Idratazione iniziale conversazioni: parsed UNA volta dal payload corrente, poi vive nel sub-hook.
   * Ulteriori hydrate (cambio task / tasks:loaded) sono governati dal `useLayoutEffect` di hydrate.
   *
   * Stabilizzazione reference: quando `taskPersistedWizardJson` è solo un echo del nostro emit
   * (cioè uguale a `lastHydratedRawRef.current`), restituiamo l'ULTIMO parsed cached, così le
   * prop `initialConversations`/`initialBaselineByKey` del sub-hook NON cambiano reference e
   * non triggerano un re-idratazione spuria (causa storica del flicker del pannello).
   * Solo cambi reali del payload (es. cambio task, hydrate da legacy) producono un nuovo parsed.
   */
  const initialConvHydratedCacheRef = React.useRef<{
    raw: string;
    parsed: UseCaseWizardPersistedStateV1 | null;
  }>({ raw: '', parsed: null });
  const initialConvHydrated = React.useMemo(() => {
    const raw = (taskPersistedWizardJson ?? '').trim();
    const cache = initialConvHydratedCacheRef.current;
    /** Echo locale: stesso raw appena idratato → ritorno cache (reference stabile). */
    if (raw === cache.raw) return cache.parsed;
    /** Echo locale: stesso raw appena emesso dal persist → idem, no re-parse. */
    if (raw && raw === lastHydratedRawRef.current && cache.parsed) return cache.parsed;
    const parsed = raw ? parseUseCaseWizardPersistedState(raw) : null;
    initialConvHydratedCacheRef.current = { raw, parsed };
    return parsed;
  }, [taskPersistedWizardJson]);

  const conv = useUseCaseConversations({
    initialConversations: initialConvHydrated?.conversations,
    initialActiveConversationId: initialConvHydrated?.activeConversationId ?? null,
    initialBaselineByKey: initialConvHydrated?.conversationAgentBaselineByKey,
    onAgentCanonicalTextChange,
  });

  const convSnapshot = React.useMemo<WizardConversationsSnapshot>(
    () => ({
      conversations: conv.conversations,
      activeConversationId: conv.activeConversationId,
      conversationAgentBaselineByKey: conv.conversationAgentBaselineByKey,
    }),
    [
      conv.conversations,
      conv.activeConversationId,
      conv.conversationAgentBaselineByKey,
    ]
  );

  const applyHydratedParsed = React.useCallback((parsed: UseCaseWizardPersistedStateV1) => {
    const si = Math.min(Math.max(0, Math.floor(parsed.stepIndex)), LAST_STEP_INDEX);
    let um =
      typeof parsed.unlockedMaxStepIndex === 'number'
        ? Math.floor(parsed.unlockedMaxStepIndex)
        : si;
    um = Math.min(Math.max(um, si), LAST_STEP_INDEX);
    setStepIndex(si);
    setUnlockedMaxStepIndex(um);
    if (typeof parsed.enabled === 'boolean') setEnabledState(parsed.enabled);
    if (parsed.useCaseListBaseline !== undefined) {
      baselineRef.current.use_case_list = parsed.useCaseListBaseline;
    }
    if (parsed.examplePhraseBaselineById && Object.keys(parsed.examplePhraseBaselineById).length > 0) {
      examplePhraseBaselineByIdRef.current = { ...parsed.examplePhraseBaselineById };
    }
    if (
      parsed.tokenizationBaselineByUseCaseId &&
      Object.keys(parsed.tokenizationBaselineByUseCaseId).length > 0
    ) {
      tokenizationBaselineByUseCaseIdRef.current = { ...parsed.tokenizationBaselineByUseCaseId };
    }
    setBaselineEpoch((n) => n + 1);
    setExamplePhraseBaselineEpoch((n) => n + 1);
    setTokenizationBaselineEpoch((n) => n + 1);
  }, []);

  React.useLayoutEffect(() => {
    if (prevInstanceIdRef.current !== instanceId) {
      prevInstanceIdRef.current = instanceId;
      lastEmittedJsonRef.current = '';
      lastHydratedRawRef.current = '';
    }

    const raw = (taskPersistedWizardJson ?? '').trim();
    /**
     * Guard idempotente: se questo raw è già stato idratato, nessuna azione (anche se i setState
     * in coda non sono ancora flushed). Evita il loop hydrate→persist→hydrate.
     */
    if (raw === lastHydratedRawRef.current) return;

    if (raw) {
      const parsed = parseUseCaseWizardPersistedState(raw);
      if (parsed) {
        lastHydratedRawRef.current = raw;
        /**
         * Allineiamo `lastEmittedJsonRef` al raw input: il `useEffect` di persist non deve
         * emettere subito una versione "normalizzata" del payload appena idratato.
         */
        lastEmittedJsonRef.current = raw;
        applyHydratedParsed(parsed);
        return;
      }
    }

    if (!key) return;
    try {
      const legacyRaw = sessionStorage.getItem(key);
      if (!legacyRaw?.trim()) return;
      const legacyParsed = parseUseCaseWizardPersistedState(legacyRaw);
      if (!legacyParsed) return;
      lastHydratedRawRef.current = raw;
      lastEmittedJsonRef.current = legacyRaw;
      applyHydratedParsed(legacyParsed);
    } catch {
      /* ignore */
    }
  }, [instanceId, taskPersistedWizardJson, key, applyHydratedParsed]);

  React.useEffect(() => {
    if (!onWizardPersist) return;
    const payload = buildWizardPayload(
      enabled,
      stepIndex,
      unlockedMaxStepIndex,
      baselineRef,
      examplePhraseBaselineByIdRef,
      tokenizationBaselineByUseCaseIdRef,
      convSnapshot
    );
    const json = serializeUseCaseWizardPersistedState(payload);
    if (json === lastEmittedJsonRef.current) return;
    lastEmittedJsonRef.current = json;
    /**
     * Il controller rimbalza questo JSON come `taskPersistedWizardJson` al render successivo.
     * È un echo locale, non una nuova idratazione esterna: marcarlo qui evita il ciclo
     * persist→prop→hydrate che può far flickerare il pannello conversazioni.
     */
    lastHydratedRawRef.current = json;
    onWizardPersist(json);
    if (key) {
      try {
        sessionStorage.setItem(key, json);
      } catch {
        /* ignore */
      }
    }
  }, [
    enabled,
    stepIndex,
    unlockedMaxStepIndex,
    baselineEpoch,
    examplePhraseBaselineEpoch,
    tokenizationBaselineEpoch,
    conv.conversations,
    conv.activeConversationId,
    conv.conversationAgentBaselineByKey,
    onWizardPersist,
    key,
  ]);

  /** Auto-unlock al raggiungimento di almeno una conversazione (analoga regola di useCases.length). */
  React.useEffect(() => {
    if (conv.conversations.length > 0) {
      setUnlockedMaxStepIndex((prev) =>
        Math.min(Math.max(prev, CONVERSATIONS_STEP_INDEX + 1), LAST_STEP_INDEX)
      );
    }
  }, [conv.conversations.length]);

  /**
   * Nota storica: in pipeline 4-step esisteva qui un `tokenizedUseCaseCount` + `useEffect`
   * che sbloccava lo step `json_generation` quando ≥1 use case era tokenizzato. Con la
   * riduzione a 3 step, `tokenization` è l'ultimo e non c'è più nulla da sbloccare. Il
   * conteggio viene calcolato dai consumer (es. `AIAgentEditorDockPanels`) per decidere
   * quali pulsanti UI mostrare (toggle JSON / «Crea prompt conversazionale»).
   */

  React.useEffect(() => {
    if (useCases.length > 0) {
      setUnlockedMaxStepIndex((prev) => Math.min(Math.max(prev, 1), LAST_STEP_INDEX));
    }
  }, [useCases.length]);

  React.useEffect(() => {
    if (useCases.length === 0) return;
    if (baselineRef.current.use_case_list !== undefined) return;
    baselineRef.current.use_case_list = serializeUseCaseListForWizardBaseline(useCases);
    setBaselineEpoch((n) => n + 1);
  }, [useCases]);

  const setEnabled = React.useCallback((value: boolean) => {
    setEnabledState(value);
    if (!value) {
      setShowNoChangesTutorial(false);
      setDialogOpen(false);
    }
  }, []);

  const currentStepId = USE_CASE_GENERATOR_WIZARD_STEP_ORDER[stepIndex] ?? 'use_case_list';
  const stepCfg = getUseCaseGeneratorWizardStepConfig(currentStepId);

  const snapshotForStep = React.useCallback(
    (id: UseCaseGeneratorWizardStepId): string => {
      switch (id) {
        case 'use_case_list':
          return serializeUseCaseListForWizardBaseline(useCases);
        default:
          return '';
      }
    },
    [useCases]
  );

  /**
   * Passo 3 — mappa per use case del flag «tokenizzazione corrente ≠ baseline AI».
   * Considera solo gli use case che hanno una baseline registrata: se la baseline è vuota
   * (mai generata dall'AI), nessuna modifica è rilevabile e l'avanzamento mostrerà il toast.
   */
  const tokenizationDiffByUseCaseId = React.useMemo<Record<string, boolean>>(() => {
    const base = tokenizationBaselineByUseCaseIdRef.current;
    if (Object.keys(base).length === 0) return {};
    const out: Record<string, boolean> = {};
    for (const u of useCases) {
      const baseValue = base[u.id];
      if (baseValue === undefined) continue;
      const current = typeof u.assistant_example_tokenized === 'string'
        ? u.assistant_example_tokenized
        : '';
      out[u.id] = current !== baseValue;
    }
    return out;
  }, [useCases, tokenizationBaselineEpoch]);

  const hasEditsSinceLastAi = React.useMemo(() => {
    const id = currentStepId;
    if (id === 'conversations') {
      /**
       * Pattern allineato al passo 1: una modifica è solo una bubble agente
       * con testo diverso dalla baseline AI dell'ultima generazione.
       */
      return conv.conversationStylePlan.modifiedAgentTurnKeys.length > 0;
    }
    if (id === 'tokenization') {
      /** Almeno una frase tokenizzata differisce dalla baseline AI catturata. */
      for (const k of Object.keys(tokenizationDiffByUseCaseId)) {
        if (tokenizationDiffByUseCaseId[k]) return true;
      }
      return false;
    }
    const baseline = baselineRef.current[id];
    const snap = snapshotForStep(id);
    if (baseline === undefined) return true;
    return snap !== baseline;
  }, [
    currentStepId,
    snapshotForStep,
    useCases,
    baselineEpoch,
    conv.conversationStylePlan,
    tokenizationDiffByUseCaseId,
  ]);

  const captureUseCaseListAiBaseline = React.useCallback((ucs?: readonly AIAgentUseCase[]) => {
    const list = ucs ?? useCases;
    baselineRef.current.use_case_list = serializeUseCaseListForWizardBaseline(list);
    setBaselineEpoch((n) => n + 1);
    setShowNoChangesTutorial(false);
  }, [useCases]);

  const captureExamplePhrasesBaseline = React.useCallback((ucs?: readonly AIAgentUseCase[]) => {
    const list = ucs ?? useCases;
    examplePhraseBaselineByIdRef.current = snapshotAssistantContentByUseCaseId(list);
    setExamplePhraseBaselineEpoch((n) => n + 1);
  }, [useCases]);

  const captureTokenizationAiBaseline = React.useCallback(
    (ucs?: readonly AIAgentUseCase[]) => {
      const list = ucs ?? useCases;
      const next: Record<string, string> = {};
      for (const u of list) {
        if (typeof u.assistant_example_tokenized === 'string' && u.assistant_example_tokenized) {
          next[u.id] = u.assistant_example_tokenized;
        }
      }
      tokenizationBaselineByUseCaseIdRef.current = next;
      setTokenizationBaselineEpoch((n) => n + 1);
      setShowNoChangesTutorial(false);
    },
    [useCases]
  );

  const setUseCaseTokenizedText = React.useCallback(
    (useCaseId: string, tokenizedText: string) => {
      if (!useCaseId) return;
      onUseCaseTokenizedTextChange?.(useCaseId, tokenizedText);
      /**
       * Bump epoch per ricompare `tokenizationDiffByUseCaseId` immediatamente. La baseline AI
       * resta intatta — è proprio così che il diff `≥ 1 edit manuale` si attiva.
       */
      setTokenizationBaselineEpoch((n) => n + 1);
    },
    [onUseCaseTokenizedTextChange]
  );

  const toggleShowTokenizedInBubbles = React.useCallback(() => {
    setShowTokenizedInBubbles((v) => !v);
  }, []);

  const toggleShowJsonPanel = React.useCallback(() => {
    setShowJsonPanel((v) => !v);
  }, []);

  /** Baseline frase assistente per id mancanti (lista use case o passo frasi): primo snapshot del testo corrente. */
  React.useEffect(() => {
    if (!isExamplePhraseStyleStep(stepIndex)) return;
    let changed = false;
    const base = examplePhraseBaselineByIdRef.current;
    for (const u of useCases) {
      if (base[u.id] === undefined) {
        const snap = snapshotAssistantContentByUseCaseId([u]);
        base[u.id] = snap[u.id] ?? '';
        changed = true;
      }
    }
    if (changed) setExamplePhraseBaselineEpoch((n) => n + 1);
  }, [stepIndex, useCases]);

  const examplePhraseStylePlan = React.useMemo((): ExamplePhraseStylePlan => {
    if (!isExamplePhraseStyleStep(stepIndex)) {
      return EMPTY_EXAMPLE_PHRASE_PLAN;
    }
    return computeExamplePhraseStylePlan(useCases, examplePhraseBaselineByIdRef.current);
  }, [stepIndex, useCases, examplePhraseBaselineEpoch]);

  const dismissNoChangesTutorial = React.useCallback(() => setShowNoChangesTutorial(false), []);

  const canSelectStep = React.useCallback(
    (index: number) => index >= 0 && index <= unlockedMaxStepIndex,
    [unlockedMaxStepIndex]
  );

  const advanceStep = React.useCallback(() => {
    setStepIndex((i) => {
      const next = Math.min(i + 1, LAST_STEP_INDEX);
      setUnlockedMaxStepIndex((u) => Math.min(Math.max(u, next + 1), LAST_STEP_INDEX));
      return next;
    });
    setShowNoChangesTutorial(false);
    setDialogOpen(false);
  }, []);

  const goToPreviousStep = React.useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
    setShowNoChangesTutorial(false);
    setDialogOpen(false);
  }, []);

  const requestAdvanceToNextStep = React.useCallback(() => {
    if (stepIndex >= LAST_STEP_INDEX) return;
    if (hasEditsSinceLastAi) {
      advanceStep();
      return;
    }
    setDialogOpen(true);
  }, [advanceStep, hasEditsSinceLastAi, stepIndex]);

  const confirmAdvanceDialog = React.useCallback(() => {
    onConfirmAdvanceWithoutEdits?.(currentStepId);
    advanceStep();
  }, [advanceStep, currentStepId, onConfirmAdvanceWithoutEdits]);

  const cancelAdvanceDialog = React.useCallback(() => {
    setDialogOpen(false);
    setShowNoChangesTutorial(true);
  }, []);

  const selectStep = React.useCallback(
    (index: number) => {
      if (index < 0 || index >= USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length) return;
      if (index > unlockedMaxStepIndex) return;
      setStepIndex(index);
      setShowNoChangesTutorial(false);
      setDialogOpen(false);
    },
    [unlockedMaxStepIndex]
  );

  const canGoPrevious = stepIndex > 0;
  const canGoNext = stepIndex < LAST_STEP_INDEX;

  /**
   * Reset contestuale Passo 2: elimina solo conversazioni + baseline conversazioni. Non tocca
   * catalogo use case e tokenizzazione, perché sono dati più a monte/a valle ma indipendenti.
   */
  const resetConversations = React.useCallback(() => {
    conv.resetAll();
    setShowTokenizedInBubbles(false);
  }, [conv]);

  /**
   * Reset contestuale Passo 3: elimina la baseline wizard della tokenizzazione. I campi
   * `assistant_example_tokenized*` sui use case sono puliti dal caller, che possiede il catalogo.
   */
  const resetTokenization = React.useCallback(() => {
    tokenizationBaselineByUseCaseIdRef.current = {};
    setShowTokenizedInBubbles(false);
    setTokenizationBaselineEpoch((n) => n + 1);
  }, []);

  /**
   * Reset «Pulisci tutto»: ripristina lo stato iniziale del wizard (step 0, nessun unlock,
   * baseline tutte vuote) e propaga il reset al sub-hook conversazioni. Aggiorna anche i
   * ref interni di idratazione/persistenza, così l'eventuale `taskPersistedWizardJson` vuoto
   * non triggera una re-idratazione spuria e il prossimo `useEffect` di persist scrive il
   * payload pulito (allineato al nuovo stato del Task).
   */
  const resetAll = React.useCallback(() => {
    baselineRef.current = {};
    examplePhraseBaselineByIdRef.current = {};
    tokenizationBaselineByUseCaseIdRef.current = {};
    lastEmittedJsonRef.current = '';
    lastHydratedRawRef.current = '';
    setStepIndex(0);
    setUnlockedMaxStepIndex(0);
    setShowNoChangesTutorial(false);
    setDialogOpen(false);
    setShowTokenizedInBubbles(false);
    setShowJsonPanel(false);
    setBaselineEpoch((n) => n + 1);
    setExamplePhraseBaselineEpoch((n) => n + 1);
    setTokenizationBaselineEpoch((n) => n + 1);
    conv.resetAll();
    if (key) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }, [conv, key]);

  return {
    enabled,
    setEnabled,
    stepIndex,
    stepCount: USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length,
    currentStepId,
    title: stepCfg.title,
    instruction: stepCfg.instructionPlain,
    tutorialIfNoChanges: stepCfg.tutorialIfNoChanges,
    showNoChangesTutorial,
    dismissNoChangesTutorial,
    unlockedMaxStepIndex,
    canSelectStep,
    selectStep,
    goToPreviousStep,
    advanceToNextStep: requestAdvanceToNextStep,
    canGoPrevious,
    canGoNext,
    hasEditsSinceLastAi,
    captureUseCaseListAiBaseline,
    captureExamplePhrasesBaseline,
    examplePhraseStylePlan,
    dialogOpen,
    dialogMessage: stepCfg.confirmNoEditsMessage,
    confirmAdvanceDialog,
    cancelAdvanceDialog,
    conversations: conv.conversations,
    activeConversationId: conv.activeConversationId,
    conversationStylePlan: conv.conversationStylePlan,
    setActiveConversationId: conv.setActiveConversationId,
    appendConversation: conv.appendConversation,
    updateConversationTurnText: conv.updateConversationTurnText,
    replaceConversation: conv.replaceConversation,
    captureConversationsBaseline: conv.captureConversationsBaseline,
    syncBubblesToCanonicalText: conv.syncBubblesToCanonicalText,
    promoteSuggestionToCanonical: conv.promoteSuggestionToCanonical,
    setSuggestionStatus: conv.setSuggestionStatus,
    showTokenizedInBubbles,
    toggleShowTokenizedInBubbles,
    showJsonPanel,
    toggleShowJsonPanel,
    captureTokenizationAiBaseline,
    setUseCaseTokenizedText,
    tokenizationDiffByUseCaseId,
    resetConversations,
    resetTokenization,
    resetAll,
  };
}
