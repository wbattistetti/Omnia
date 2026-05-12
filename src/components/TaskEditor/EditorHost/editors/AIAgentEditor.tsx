/**
 * Design-time shell for AI Agent tasks: composes dockable layout, toolbar wiring, and editor hooks.
 * Domain logic lives under `./aiAgentEditor/`; this file stays a thin orchestrator.
 */
import React from 'react';
import type { EditorProps } from '../types';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { useAIProvider } from '@context/AIProviderContext';
import { Bot, Loader2, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { AI_AGENT_HEADER_COLOR, LABEL_GENERATE_USE_CASES, LABEL_GENERATING_IA_AGENT } from './aiAgentEditor/constants';
import type { AIAgentEditorDockContextValue } from './aiAgentEditor/AIAgentEditorDockContext';
import { AIAgentEditorDockShell } from './aiAgentEditor/AIAgentEditorDockShell';
import { useAIAgentEditorController } from './aiAgentEditor/useAIAgentEditorController';
import { useAIAgentToolbarController } from './aiAgentEditor/useAIAgentToolbarController';
import type {
  UseCaseGeneratorWizardConversation,
  UseCaseGeneratorWizardStepId,
} from '@domain/useCaseGeneratorWizard/types';
import { compileUseCaseConversationalText } from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';
import { applyAllDesignerVotesUp } from './aiAgentEditor/useCaseComposerDesignerVotes';
import { normalizeUseCaseSiblingOrder } from './aiAgentEditor/useCaseHierarchy';
import { useUseCaseGeneratorWizard } from './aiAgentEditor/useCaseGeneratorWizard/useUseCaseGeneratorWizard';
import { USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS } from '@domain/useCaseGeneratorWizard/registry';
import { mergeAssistantPhraseDraftIntoUseCases } from './aiAgentEditor/mergeAssistantPhraseDraftIntoUseCases';
import { useAIAgentConversationActions } from './aiAgentEditor/useAIAgentConversationActions';
import {
  tokenizeAIAgentUseCasesApi,
  parseExternalGenerateUseCasesJson,
  parseExternalAssembleConversationJson,
  type BuildAIAgentPromptPreviewParams,
} from '@services/aiAgentDesignApi';
import {
  getAssistantExample,
  type AIAgentLogicalStep,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';
import { useExternalLLMHandoffPref } from './aiAgentEditor/useExternalLLMHandoffPref';
import { useFullscreenEditorPref } from './aiAgentEditor/useFullscreenEditorPref';
import { useAppToolbarBottom } from './aiAgentEditor/useAppToolbarBottom';
import { ExternalLLMHandoffDialog } from './aiAgentEditor/useCaseGeneratorWizard/ExternalLLMHandoffDialog';
import { resolveAiAgentOutputLanguage } from './aiAgentEditor/resolveAiAgentOutputLanguage';
import { createPortal } from 'react-dom';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { MissingAiModelToast } from '@components/common/MissingAiModelToast';
import { openOmniaTutorForMissingModel } from '@utils/aiModelGuard';

export default function AIAgentEditor({ task, onToolbarUpdate, hideHeader }: EditorProps) {
  const instanceId = task.instanceId || task.id;
  const pdUpdate = useProjectDataUpdate();
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;
  const { provider, model } = useAIProvider();

  const deferAgentMessagesInUseCaseListRef = React.useRef(false);

  const c = useAIAgentEditorController({
    instanceId,
    projectId,
    provider,
    model,
    getDeferAgentMessages: () => deferAgentMessagesInUseCaseListRef.current,
  });

  const onConfirmAdvanceWithoutEdits = React.useCallback(
    (stepId: UseCaseGeneratorWizardStepId) => {
      if (stepId !== 'use_case_list') return;
      c.setUseCases((prev) => applyAllDesignerVotesUp(prev));
    },
    [c.setUseCases]
  );

  const [assistantPhraseDraftById, setAssistantPhraseDraftById] = React.useState<
    Record<string, string>
  >({});

  React.useEffect(() => {
    setAssistantPhraseDraftById({});
  }, [c.instanceId]);

  const useCasesForWizardStylePlan = React.useMemo(
    () => mergeAssistantPhraseDraftIntoUseCases(c.useCases, assistantPhraseDraftById),
    [c.useCases, assistantPhraseDraftById]
  );

  const onAssistantPhraseDraftChange = React.useCallback(
    (useCaseId: string | null, draftText: string | null) => {
      setAssistantPhraseDraftById((prev) => {
        if (useCaseId === null && draftText === null) return {};
        if (useCaseId === null) return prev;
        if (draftText === null) {
          if (!(useCaseId in prev)) return prev;
          const next = { ...prev };
          delete next[useCaseId];
          return next;
        }
        return { ...prev, [useCaseId]: draftText };
      });
    },
    []
  );

  /**
   * Filosofia bubble = canonical: l'edit di una bubble agente nel passo 2 deve aggiornare la
   * frase canonica del catalogo (`dialogue` del primo turn assistente). Il wizard chiama
   * questo callback dopo aver propagato l'edit a tutte le bubble dello stesso useCaseId.
   */
  const handleAgentCanonicalTextChange = React.useCallback(
    (useCaseId: string, text: string) => {
      c.setUseCases((prev) =>
        prev.map((u) => {
          if (u.id !== useCaseId) return u;
          const turnId = u.dialogue.find((t) => t.role === 'assistant')?.turn_id;
          if (!turnId) return u;
          let mutated = false;
          const dialogue = u.dialogue.map((t) => {
            if (t.role !== 'assistant' || t.turn_id !== turnId) return t;
            if (t.content === text) return t;
            mutated = true;
            return { ...t, content: text, motor_snapshot: undefined, userEdited: true };
          });
          if (!mutated) return u;
          return { ...u, dialogue, designer_edit_confirmed: true as const };
        })
      );
    },
    [c.setUseCases]
  );

  /**
   * Forward-decl: il callback edit inline del passo 3 vive in {@link AIAgentEditor} ma deve
   * essere passato all'hook wizard. Usiamo una ref-stabile per evitare ridichiarazioni cicliche
   * (l'effettiva implementazione è definita più sotto, una volta noto `c.setUseCases`).
   */
  const onUseCaseTokenizedTextChangeRef = React.useRef<(useCaseId: string, t: string) => void>(
    () => {}
  );
  const onUseCaseTokenizedTextChangeStable = React.useCallback(
    (useCaseId: string, t: string) => onUseCaseTokenizedTextChangeRef.current(useCaseId, t),
    []
  );

  const useCaseGenWizard = useUseCaseGeneratorWizard({
    instanceId: c.instanceId,
    useCases: useCasesForWizardStylePlan,
    taskPersistedWizardJson: c.agentUseCaseWizardStateJson,
    onWizardPersist: c.persistAgentUseCaseWizardState,
    onConfirmAdvanceWithoutEdits,
    onAgentCanonicalTextChange: handleAgentCanonicalTextChange,
    onUseCaseTokenizedTextChange: onUseCaseTokenizedTextChangeStable,
  });

  /** Always keep IA-generated assistant turns: lista use case mostra etichetta + scenario + messaggio. */
  deferAgentMessagesInUseCaseListRef.current = false;
  const captureUseCaseListAiBaseline = useCaseGenWizard.captureUseCaseListAiBaseline;

  const [useCaseBundleFeedback, setUseCaseBundleFeedback] = React.useState<string | null>(null);
  const [useCaseHighlightIds, setUseCaseHighlightIds] = React.useState<readonly string[]>([]);

  const dismissUseCaseBundleFeedback = React.useCallback(() => setUseCaseBundleFeedback(null), []);

  const [assistantPhraseStyleNewIds, setAssistantPhraseStyleNewIds] = React.useState<readonly string[]>([]);

  React.useEffect(() => {
    const id = useCaseGenWizard.currentStepId;
    if (id !== 'use_case_list') {
      setAssistantPhraseStyleNewIds([]);
    }
  }, [useCaseGenWizard.currentStepId]);

  const runPropagateExamplePhraseStyle = React.useCallback(async () => {
    const plan = useCaseGenWizard.examplePhraseStylePlan;
    if (!plan.showStyleCta) return;
    const res = await c.handlePropagateExamplePhraseStyle({
      styleExampleUseCaseIds: plan.modifiedIds,
      targetUseCaseIds: plan.targetIds,
    });
    if (res) {
      setAssistantPhraseDraftById({});
      useCaseGenWizard.captureExamplePhrasesBaseline(res.nextUseCases);
      setAssistantPhraseStyleNewIds(res.updatedIds);
      setUseCaseBundleFeedback('Messaggi aggiornati con il nuovo stile.');
    }
  }, [
    c.handlePropagateExamplePhraseStyle,
    useCaseGenWizard.captureExamplePhrasesBaseline,
    useCaseGenWizard.examplePhraseStylePlan,
  ]);

  const clearUseCaseHighlight = React.useCallback((useCaseId: string) => {
    setUseCaseHighlightIds((prev) => prev.filter((id) => id !== useCaseId));
  }, []);

  const externalLLMHandoff = useExternalLLMHandoffPref();
  /**
   * Fullscreen mode: l'AI Agent editor occupa tutta l'area dell'app sotto la toolbar globale,
   * nascondendo TaskTree e ogni altra chrome circostante. Preferenza persistita in `localStorage`
   * (vedi {@link useFullscreenEditorPref}). Quando attiva, l'intero render del componente è
   * proiettato in un Portal — vedi blocco JSX finale.
   */
  const fullscreenPref = useFullscreenEditorPref();
  const appToolbarBottom = useAppToolbarBottom();

  /**
   * Tipologie di modale handoff: una per target. Il modale vive in {@link AIAgentEditor} così
   * lo stato è condiviso tra header e wizard (il pulsante può essere cliccato da entrambi).
   */
  type HandoffStateGenerate = {
    kind: 'generate_use_cases';
    promptRequest: BuildAIAgentPromptPreviewParams;
    /** Modalità extend (mantiene catalog esistente) vs replace (nuovo bundle). */
    extendMode: boolean;
  };
  type HandoffStateAssemble = {
    kind: 'assemble_conversation';
    promptRequest: BuildAIAgentPromptPreviewParams;
    outcome: 'positive' | 'negative';
    allowSuggestedUseCases: boolean;
  };
  type HandoffState = HandoffStateGenerate | HandoffStateAssemble;

  const [handoffState, setHandoffState] = React.useState<HandoffState | null>(null);
  const closeHandoff = React.useCallback(() => setHandoffState(null), []);

  /**
   * Side-effect post-apply per il bundle use case (replace o extend): replica la fine di
   * {@link runGenerateUseCaseBundle} (drafts, baseline, feedback, highlight).
   */
  const applyUseCaseBundleOutcome = React.useCallback(
    (result: ReturnType<typeof c.handleApplyExternalGeneratedUseCases>) => {
      setAssistantPhraseDraftById({});
      captureUseCaseListAiBaseline(result.useCases);
      if (result.mode === 'extend' && result.addedCount > 0) {
        setUseCaseBundleFeedback(`Ho aggiunto ${result.addedCount} use case.`);
      } else if (result.mode === 'replace' && result.addedCount > 0) {
        setUseCaseBundleFeedback(`Generati ${result.addedCount} use case.`);
      } else {
        setUseCaseBundleFeedback(null);
      }
      setUseCaseHighlightIds(result.highlightIds);
    },
    [c.handleApplyExternalGeneratedUseCases, captureUseCaseListAiBaseline]
  );

  const runGenerateUseCaseBundle = React.useCallback(async () => {
    if (externalLLMHandoff.enabled) {
      try {
        const { userDesc, extendFrom } = c.computeGenerateUseCasesPromptInputs();
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const promptRequest: BuildAIAgentPromptPreviewParams = {
          target: 'generate_use_cases',
          provider,
          model,
          outputLanguage,
          userDesc,
          runtimeContext: c.agentPrompt.trim() || undefined,
          globalStyleContract: c.globalStyleContract,
          globalStyleId: c.useCaseGlobalStyleId,
          ...(extendFrom ? { extendFrom } : {}),
        };
        setHandoffState({
          kind: 'generate_use_cases',
          promptRequest,
          extendMode: Boolean(extendFrom),
        });
      } catch (err) {
        setUseCaseBundleFeedback(err instanceof Error ? err.message : String(err));
      }
      return;
    }
    const result = await c.handleGenerateUseCaseBundle();
    if (!result) return;
    applyUseCaseBundleOutcome(result);
  }, [
    externalLLMHandoff.enabled,
    c.computeGenerateUseCasesPromptInputs,
    c.handleGenerateUseCaseBundle,
    c.agentPrompt,
    c.globalStyleContract,
    c.useCaseGlobalStyleId,
    provider,
    model,
    applyUseCaseBundleOutcome,
  ]);

  const runRegenerateUseCase = React.useCallback(
    async (useCaseId: string) => {
      const merged = await c.handleRegenerateUseCase(useCaseId);
      if (merged) {
        captureUseCaseListAiBaseline(
          normalizeUseCaseSiblingOrder(
            c.useCases.map((u) => (u.id === useCaseId ? merged : u)),
            c.useCaseSiblingSortMode
          )
        );
      }
      return merged;
    },
    [
      c.handleRegenerateUseCase,
      c.useCases,
      c.useCaseSiblingSortMode,
      captureUseCaseListAiBaseline,
    ]
  );

  /** Passo 2 wizard — orchestrazione azioni AI conversazioni (assemble + proofread). */
  const conversationActions = useAIAgentConversationActions({
    provider,
    model,
    useCases: c.useCases,
    runtimeContext: c.agentPrompt,
    globalStyleContract: c.globalStyleContract,
    onError: (msg) => setUseCaseBundleFeedback(msg),
  });

  /**
   * Esegue una creazione di conversazione con i parametri scelti dal pulsante del pannello DX.
   *
   * Euristica del batch (nessun "magic number" 1 o 2 fisso):
   * - Calcoliamo un obiettivo «ragionevole» per tipo in funzione del catalogo:
   *     positive/negative: `clamp(ceil(useCases.length / 3), 2, 4)`
   *     suggested        : 2 (cap basso — dopo 2 emergenti la review è satura)
   * - Per il tipo cliccato calcoliamo quante ce ne sono già; il batch è quante mancano per
   *   raggiungere l'obiettivo (ma sempre ≥ 1 se l'utente clicca esplicitamente).
   * - Limite hard del totale: `USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS` (oggi 10).
   *
   * Effetto pratico:
   *  - primo click di un tipo su catalogo medio → genera 2–3 conversazioni dello stesso tipo;
   *  - re-click dopo aver già raggiunto l'obiettivo → genera 1 (l'utente ne vuole comunque
   *    una in più).
   */
  const runAssembleConversation = React.useCallback(
    async (params: {
      outcome: 'positive' | 'negative';
      allowSuggestedUseCases: boolean;
    }) => {
      const existing = useCaseGenWizard.conversations;
      const slotsLeft = USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS - existing.length;
      if (slotsLeft <= 0) return;

      if (externalLLMHandoff.enabled) {
        if (c.useCases.length < 2) {
          setUseCaseBundleFeedback('Servono almeno 2 use case per montare una conversazione.');
          return;
        }
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const promptRequest: BuildAIAgentPromptPreviewParams = {
          target: 'assemble_conversation',
          provider,
          model,
          outputLanguage,
          useCases: c.useCases,
          runtimeContext: c.agentPrompt.trim() || undefined,
          globalStyleContract: c.globalStyleContract,
          previousConversationsCount: existing.length,
          outcome: params.outcome,
          allowSuggestedUseCases: params.allowSuggestedUseCases,
        };
        setHandoffState({
          kind: 'assemble_conversation',
          promptRequest,
          outcome: params.outcome,
          allowSuggestedUseCases: params.allowSuggestedUseCases,
        });
        return;
      }

      const isSuggestedBatch = params.allowSuggestedUseCases;
      const matchesRequestedType = (
        c: UseCaseGeneratorWizardConversation
      ): boolean => {
        if (isSuggestedBatch) {
          return c.turns.some(
            (t) =>
              t.role === 'agent' &&
              t.suggestion !== undefined &&
              t.suggestion.status !== 'rejected'
          );
        }
        return c.outcome === params.outcome;
      };
      const sameTypeCount = existing.filter(matchesRequestedType).length;

      const catalogTarget = isSuggestedBatch
        ? 2
        : Math.min(4, Math.max(2, Math.ceil(c.useCases.length / 3)));
      const desiredDelta = Math.max(0, catalogTarget - sameTypeCount);
      /** Se l'utente ha già raggiunto l'obiettivo e riclicca: aggiungiamo comunque 1. */
      const batchSize = Math.min(slotsLeft, Math.max(1, desiredDelta));

      const { outcome, allowSuggestedUseCases } = params;

      let accumulated = [...existing];
      let created = 0;
      for (let i = 0; i < batchSize; i++) {
        const conv = await conversationActions.handleAssembleConversation({
          previousConversationsCount: accumulated.length,
          outcome,
          allowSuggestedUseCases,
        });
        if (!conv) break;
        useCaseGenWizard.appendConversation(conv);
        accumulated = [...accumulated, conv];
        useCaseGenWizard.captureConversationsBaseline(accumulated);
        created += 1;
      }

      if (created === 0) return;
      const outcomeLabel = outcome === 'positive' ? 'positiva' : 'negativa';
      const suggestedHint = allowSuggestedUseCases ? ' (con use case emergenti ammessi)' : '';
      setUseCaseBundleFeedback(
        created > 1
          ? `Montate ${created} conversazioni ${outcomeLabel}${suggestedHint}. Usa i tab numerati sotto l'area di lavoro per passare dall'una all'altra.`
          : `Conversazione ${outcomeLabel} ${accumulated.length} montata${suggestedHint}.`
      );
    },
    [
      conversationActions,
      useCaseGenWizard,
      c.useCases,
      c.agentPrompt,
      c.globalStyleContract,
      externalLLMHandoff.enabled,
      provider,
      model,
    ]
  );

  /**
   * Apply post-handoff (handoff → parsed JSON esterno).
   * - generate_use_cases: applica via {@link c.handleApplyExternalGeneratedUseCases} con la stessa
   *   logica del path standard.
   * - assemble_conversation: appende la conversazione + cattura baseline + feedback.
   */
  const applyHandoffGenerateUseCases = React.useCallback(
    (parsed: { useCases: AIAgentUseCase[]; logicalSteps: AIAgentLogicalStep[] | null }) => {
      const outcome = c.handleApplyExternalGeneratedUseCases(parsed);
      applyUseCaseBundleOutcome(outcome);
    },
    [c.handleApplyExternalGeneratedUseCases, applyUseCaseBundleOutcome]
  );

  const applyHandoffAssembleConversation = React.useCallback(
    (parsedConversation: UseCaseGeneratorWizardConversation) => {
      useCaseGenWizard.appendConversation(parsedConversation);
      const nextAll = [...useCaseGenWizard.conversations, parsedConversation];
      useCaseGenWizard.captureConversationsBaseline(nextAll);
      const outcomeLabel = parsedConversation.outcome === 'positive' ? 'positiva' : 'negativa';
      const suggestedHint = parsedConversation.allowsSuggestedUseCases
        ? ' (con use case emergenti ammessi)'
        : '';
      setUseCaseBundleFeedback(
        `Conversazione ${outcomeLabel} ${nextAll.length} montata${suggestedHint}.`
      );
    },
    [useCaseGenWizard]
  );

  /**
   * «Pulisci tutto»: pipeline coordinata fra wizard (memoria) e controller (stato persistito).
   * Lascia intatti descrizione, sezioni IR, proposed fields, runtime IA config; azzera tutto il
   * resto: catalog, conversazioni, JSON generati, baselines, drafts.
   */
  const runClearAllWizardOutput = React.useCallback(() => {
    useCaseGenWizard.resetAll();
    c.handleClearWizardOutput();
    setAssistantPhraseDraftById({});
    setAssistantPhraseStyleNewIds([]);
    setUseCaseBundleFeedback(null);
    setUseCaseHighlightIds([]);
    setHandoffState(null);
  }, [useCaseGenWizard, c.handleClearWizardOutput]);

  /**
   * Clear contestuale Passo 2: elimina solo le conversazioni montate e le loro baseline.
   * I use case e le tokenizzazioni restano intatti.
   */
  const runClearWizardConversations = React.useCallback(() => {
    useCaseGenWizard.resetConversations();
    setUseCaseBundleFeedback(null);
    setHandoffState(null);
  }, [useCaseGenWizard]);

  /**
   * Clear contestuale Passo 3: elimina solo i campi di tokenizzazione dai use case e la
   * baseline wizard correlata. Le conversazioni restano disponibili.
   */
  const runClearWizardTokenization = React.useCallback(() => {
    useCaseGenWizard.resetTokenization();
    c.setUseCases((prev) =>
      prev.map((u) => {
        if (
          u.assistant_example_tokenized === undefined &&
          u.assistant_example_tokenized_source === undefined
        ) {
          return u;
        }
        const next = { ...u };
        delete next.assistant_example_tokenized;
        delete next.assistant_example_tokenized_source;
        return next;
      })
    );
    setUseCaseBundleFeedback(null);
    setHandoffState(null);
  }, [c.setUseCases, useCaseGenWizard]);

  const runProofreadConversationAgentTurns = React.useCallback(async () => {
    const activeId = useCaseGenWizard.activeConversationId;
    if (!activeId) return;
    const active = useCaseGenWizard.conversations.find((c) => c.conversationId === activeId);
    if (!active) return;
    const modifiedForActive = useCaseGenWizard.conversationStylePlan.modifiedAgentTurns.filter(
      (t) => t.conversationId === activeId
    );
    if (modifiedForActive.length === 0) return;
    const next = await conversationActions.handleProofreadConversationAgentTurns({
      conversation: active,
      modifiedAgentTurns: modifiedForActive.map((m) => ({
        turnId: m.turnId,
        useCaseId: m.useCaseId,
        currentText: m.currentText,
        baselineText: m.baselineText,
      })),
    });
    if (!next) return;
    useCaseGenWizard.replaceConversation(next);
    /**
     * Le frasi proofread diventano la nuova baseline: ulteriori edit manuali sono i prossimi
     * candidati per la correzione. Inoltre, dato che ogni bubble corregge il canonico,
     * sincronizziamo il catalogo con il testo proofread.
     */
    const nextAll = useCaseGenWizard.conversations.map((c) =>
      c.conversationId === next.conversationId ? next : c
    );
    useCaseGenWizard.captureConversationsBaseline(nextAll);
    /**
     * Per ogni bubble agente reale corretta: aggiorniamo il canonico del catalogo
     * (single source of truth = frase canonica = ciò che ora mostra la bubble).
     */
    for (const t of next.turns) {
      if (t.role !== 'agent') continue;
      if (t.suggestion) continue;
      handleAgentCanonicalTextChange(t.useCaseId, t.text);
    }
    setUseCaseBundleFeedback('Frasi modificate corrette (ortografia).');
  }, [conversationActions, useCaseGenWizard, handleAgentCanonicalTextChange]);

  /**
   * Promuove uno use case emergente: crea un nuovo use case nel catalogo (con la frase agente
   * della bubble come canonical assistant_example) e collega tutte le bubble emergenti dello
   * stesso `useCaseId` al nuovo id reale.
   */
  const runPromoteSuggestionToCatalog = React.useCallback(
    async (conversationId: string, turnId: string) => {
      const conv = useCaseGenWizard.conversations.find((cn) => cn.conversationId === conversationId);
      if (!conv) return;
      const turn = conv.turns.find((t) => t.turnId === turnId);
      if (!turn || turn.role !== 'agent' || !turn.suggestion || turn.suggestion.status !== 'pending') {
        return;
      }
      try {
        const newUseCaseId = await c.handleCreateUseCase({
          label: turn.suggestion.proposedLabel,
          parentId: null,
          creationScope: 'single',
        });
        /**
         * Allinea il canonico al testo della bubble (la create AI può generarne uno diverso):
         * la bubble pending era già la canonical phrase de facto per il designer.
         */
        handleAgentCanonicalTextChange(newUseCaseId, turn.text);
        useCaseGenWizard.promoteSuggestionToCanonical(
          conversationId,
          turnId,
          newUseCaseId,
          turn.suggestion.proposedLabel
        );
        setUseCaseBundleFeedback(
          `Use case «${turn.suggestion.proposedLabel}» aggiunto al catalogo.`
        );
      } catch (err) {
        setUseCaseBundleFeedback(
          `Errore durante la promozione: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    [c, handleAgentCanonicalTextChange, useCaseGenWizard]
  );

  const runRejectSuggestion = React.useCallback(
    (conversationId: string, turnId: string) => {
      useCaseGenWizard.setSuggestionStatus(conversationId, turnId, 'rejected');
      setUseCaseBundleFeedback('Suggerimento scartato.');
    },
    [useCaseGenWizard]
  );

  /**
   * Passo 3 wizard — edit inline della frase tokenizzata di uno use case.
   * Aggiorna `assistant_example_tokenized` + `assistant_example_tokenized_source` con il
   * canonico corrente, così l'avviso «da ritokenizzare» resta in `false` finché il canonico
   * non cambia di nuovo. NON tocca la baseline AI (il diff cattura l'edit manuale).
   */
  const handleUseCaseTokenizedTextChange = React.useCallback(
    (useCaseId: string, tokenizedText: string) => {
      c.setUseCases((prev) =>
        prev.map((u) => {
          if (u.id !== useCaseId) return u;
          const source = getAssistantExample(u);
          if (
            u.assistant_example_tokenized === tokenizedText &&
            u.assistant_example_tokenized_source === source
          ) {
            return u;
          }
          return {
            ...u,
            assistant_example_tokenized: tokenizedText,
            assistant_example_tokenized_source: source,
          };
        })
      );
    },
    [c.setUseCases]
  );

  /** Aggancio della ref forward-declared al callback definitivo. */
  React.useEffect(() => {
    onUseCaseTokenizedTextChangeRef.current = handleUseCaseTokenizedTextChange;
  }, [handleUseCaseTokenizedTextChange]);

  const [tokenizeUseCasesBusy, setTokenizeUseCasesBusy] = React.useState(false);

  /**
   * Passo 3 wizard — Tokenizza con l'AI la frase canonica di tutti gli use case correnti.
   * A successo aggiorna `assistant_example_tokenized` + `assistant_example_tokenized_source`
   * su ciascuno e cattura la baseline AI (`tokenizationBaselineByUseCaseId`).
   */
  const runTokenizeUseCases = React.useCallback(async () => {
    if (tokenizeUseCasesBusy) return;
    /** Solo use case con frase canonica non vuota: gli altri saranno scartati a monte. */
    const candidates = c.useCases.filter((u) => getAssistantExample(u).trim().length > 0);
    if (candidates.length === 0) {
      setUseCaseBundleFeedback('Nessuna frase canonica da tokenizzare.');
      return;
    }
    setTokenizeUseCasesBusy(true);
    try {
      const res = await tokenizeAIAgentUseCasesApi({
        useCases: candidates,
        provider,
        model,
      });
      if (res.updates.length === 0) return;
      const byId = new Map(res.updates.map((u) => [u.useCaseId, u.tokenizedText]));
      let nextUseCases: import('@types/aiAgentUseCases').AIAgentUseCase[] = [];
      c.setUseCases((prev) => {
        const next = prev.map((u) => {
          const t = byId.get(u.id);
          if (!t) return u;
          return {
            ...u,
            assistant_example_tokenized: t,
            assistant_example_tokenized_source: getAssistantExample(u),
          };
        });
        nextUseCases = next;
        return next;
      });
      useCaseGenWizard.captureTokenizationAiBaseline(nextUseCases);
      setUseCaseBundleFeedback(
        res.updates.length === 1
          ? 'Tokenizzata 1 frase canonica.'
          : `Tokenizzate ${res.updates.length} frasi canoniche.`
      );
    } catch (err) {
      setUseCaseBundleFeedback(
        `Errore tokenizzazione: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setTokenizeUseCasesBusy(false);
    }
  }, [tokenizeUseCasesBusy, c.setUseCases, c.useCases, provider, model, useCaseGenWizard]);

  /** Mappa derivata `useCaseId → token runtime` per le bubble Passo 2. */
  const tokenizedByUseCaseId = React.useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const u of c.useCases) {
      const compiled = compileUseCaseConversationalText(u);
      if (compiled?.tokenizedText) {
        out[u.id] = compiled.tokenizedText;
      }
    }
    return out;
  }, [c.useCases]);

  /**
   * Stable refs — inline `() => c.handleX()` in render made `primaryToolbarButtons` new every frame
   * → toolbar useEffect → onToolbarUpdate loop.
   *
   * Guard: when no model is selected in Omnia Tutor we never call the LLM. Instead we open the
   * Settings page with the missing-model banner so the designer fixes the configuration.
   * The dock-mirrored CTA reuses this callback, so the guard applies there too.
   */
  const onPrimaryAgentAction = React.useCallback(() => {
    if (!model) {
      openOmniaTutorForMissingModel();
      return;
    }
    void c.handleGenerate();
  }, [c.handleGenerate, model]);

  const onGenerateUseCaseBundleAction = React.useCallback(() => {
    if (!model) {
      openOmniaTutorForMissingModel();
      return;
    }
    void runGenerateUseCaseBundle();
  }, [model, runGenerateUseCaseBundle]);

  const [promptFinaleJsMode, setPromptFinaleJsMode] = React.useState(false);

  const backendsAddManualHandlerRef = React.useRef<(() => void) | null>(null);
  const registerBackendsAddManualHandler = React.useCallback((handler: (() => void) | null) => {
    backendsAddManualHandlerRef.current = handler;
  }, []);
  const invokeBackendsAddManual = React.useCallback(() => {
    backendsAddManualHandlerRef.current?.();
  }, []);

  const showRightPanel =
    c.hasAgentGeneration ||
    c.proposedFields.length > 0 ||
    c.agentPrompt.trim().length > 0;

  const { primaryAgentActionLabel } = useAIAgentToolbarController({
    task,
    hideHeader,
    onToolbarUpdate,
    hasAgentGeneration: c.hasAgentGeneration,
    showRightPanel,
    showPrimaryAgentAction: c.showPrimaryAgentAction,
    generating: c.generating,
    useCaseComposerBusy: c.useCaseComposerBusy,
    useCaseBundleGenerationBusy: c.useCaseBundleGenerationBusy,
    useCasePhraseStylePropagationBusy: c.useCasePhraseStylePropagationBusy,
    onPrimaryAgentAction,
    onGenerateUseCaseBundle: onGenerateUseCaseBundleAction,
    isExpanded: fullscreenPref.enabled,
    onToggleExpanded: fullscreenPref.toggle,
  });

  const headerColor = AI_AGENT_HEADER_COLOR;

  const headerAction = c.showPrimaryAgentAction ? (
    <CreateAgentHeaderButton
      generating={c.generating}
      label={primaryAgentActionLabel}
      onPrimaryAction={onPrimaryAgentAction}
    />
  ) : null;

  const dockValue: AIAgentEditorDockContextValue = {
    instanceId: c.instanceId,
    hasAgentGeneration: c.hasAgentGeneration,
    designDescription: c.designDescription,
    setDesignDescription: c.setDesignDescription,
    composedRuntimeMarkdown: c.composedRuntimeMarkdown,
    structuredDesignDirty: c.structuredDesignDirty,
    structuredSectionsState: c.structuredSectionsState,
    onApplyRevisionOps: c.applyRevisionOps,
    onApplyOtCommit: c.applyOtCommit,
    onUndoSection: c.undoSection,
    onRedoSection: c.redoSection,
    structuredOtEnabled: c.structuredOtEnabled,
    iaRevisionDiffBySection: c.iaRevisionDiffBySection,
    onDismissIaRevisionForSection: c.dismissIaRevisionForSection,
    generating: c.generating,
    showRightPanel,
    headerAction,
    primaryAgentActionLabel,
    proposedFields: c.proposedFields,
    outputVariableMappings: c.outputVariableMappings,
    onUpdateProposedField: c.updateProposedField,
    onRemoveProposedField: c.removeProposedField,
    onProposedLabelBlur: c.syncFlowVariableFromLabel,
    logicalSteps: c.logicalSteps,
    useCases: c.useCases,
    setUseCases: c.setUseCases,
    useCaseComposerBusy: c.useCaseComposerBusy,
    useCaseBundleGenerationBusy: c.useCaseBundleGenerationBusy,
    useCasePhraseStylePropagationBusy: c.useCasePhraseStylePropagationBusy,
    useCasePhraseStyleBatchProgress: c.useCasePhraseStyleBatchProgress,
    useCaseCreationMessage: c.useCaseCreationMessage,
    useCaseComposerError: c.useCaseComposerError,
    onClearUseCaseComposerError: c.clearUseCaseComposerError,
    onGenerateUseCaseBundle: runGenerateUseCaseBundle,
    onCreateUseCase: c.handleCreateUseCase,
    onRegenerateUseCase: runRegenerateUseCase,
    onRegenerateAgentMessage: c.handleRegenerateAgentMessage,
    onAnnotateAgentMessageForJson: c.handleAnnotateAgentMessageForJson,
    onDeleteUseCase: c.handleDeleteUseCase,
    useCaseGlobalStyleId: c.useCaseGlobalStyleId,
    setUseCaseGlobalStyleId: c.setUseCaseGlobalStyleId,
    previewStyleId: c.previewStyleId,
    setPreviewStyleId: c.setPreviewStyleId,
    initialStateTemplateJson: c.initialStateTemplateJson,
    agentRuntimeCompactJson: c.agentRuntimeCompactJson,
    previewByStyle: c.previewByStyle,
    backendPlaceholders: c.backendPlaceholders,
    insertBackendPathAtSection: c.insertBackendPathAtSection,
    insertBackendPathInDesign: c.insertBackendPathInDesign,
    agentPromptTargetPlatform: c.agentPromptTargetPlatform,
    setAgentPromptTargetPlatform: c.setAgentPromptTargetPlatform,
    agentImmediateStart: c.agentImmediateStart,
    setAgentImmediateStart: c.setAgentImmediateStart,
    compiledPlatformOutput: c.compiledPlatformOutput,
    compiledPromptForTargetPlatform: c.compiledPromptForTargetPlatform,
    promptFinalAligned: c.promptFinalAligned,
    ensurePromptFinalDeterministicCompile: c.ensurePromptFinalDeterministicCompile,
    promptFinaleJsMode,
    setPromptFinaleJsMode,

    projectId,
    iaRuntimeConfig: c.iaRuntimeConfig,
    setIaRuntimeConfig: c.setIaRuntimeConfig,
    iaRuntimeLoadedFrom: c.iaRuntimeLoadedFrom,
    saveIaRuntimeOverrideToTask: c.saveIaRuntimeOverrideToTask,
    persistIaRuntimeOverrideSnapshot: c.persistIaRuntimeOverrideSnapshot,

    registerBackendsAddManualHandler,
    invokeBackendsAddManual,

    useCaseGeneratorWizard: useCaseGenWizard,

    useCaseBundleFeedback,
    onDismissUseCaseBundleFeedback: dismissUseCaseBundleFeedback,
    useCaseHighlightIds,
    onClearUseCaseHighlight: clearUseCaseHighlight,

    onPropagateExamplePhraseStyle: runPropagateExamplePhraseStyle,
    assistantPhraseStyleNewIds,
    onAssistantPhraseDraftChange,

    useCaseSiblingSortMode: c.useCaseSiblingSortMode,
    setUseCaseSiblingSortMode: c.setUseCaseSiblingSortMode,

    onAssembleConversation: runAssembleConversation,
    assembleConversationBusy: conversationActions.assembleConversationBusy,
    onProofreadConversationAgentTurns: runProofreadConversationAgentTurns,
    proofreadConversationBusy: conversationActions.proofreadConversationBusy,
    onPromoteSuggestionToCatalog: runPromoteSuggestionToCatalog,
    onRejectSuggestion: runRejectSuggestion,
    onTokenizeUseCases: runTokenizeUseCases,
    tokenizeUseCasesBusy,
    tokenizedByUseCaseId,
    externalLLMHandoffEnabled: externalLLMHandoff.enabled,
    onToggleExternalLLMHandoff: externalLLMHandoff.toggle,
    onClearAllWizardOutput: runClearAllWizardOutput,
    onClearWizardConversations: runClearWizardConversations,
    onClearWizardTokenization: runClearWizardTokenization,
    /**
     * Overlay confinato al pannello use case del wizard: il modale «LLM manual handoff» è
     * renderizzato DENTRO il rettangolo del wizard (non viewport), così il backdrop oscura
     * solo quel pannello.
     */
    wizardOverlay:
      handoffState && handoffState.kind === 'generate_use_cases' ? (
        <ExternalLLMHandoffDialog
          open
          title="Genera use case con motore esterno"
          applyButtonLabel="Genera use case"
          promptPreviewRequest={handoffState.promptRequest}
          onParseResponse={(raw) =>
            parseExternalGenerateUseCasesJson(raw, { extendMode: handoffState.extendMode })
          }
          onApply={(parsed) => applyHandoffGenerateUseCases(parsed)}
          onClose={closeHandoff}
        />
      ) : handoffState && handoffState.kind === 'assemble_conversation' ? (
        <ExternalLLMHandoffDialog
          open
          title="Monta una conversazione con motore esterno"
          applyButtonLabel="Crea conversazione"
          promptPreviewRequest={handoffState.promptRequest}
          onParseResponse={(raw) =>
            parseExternalAssembleConversationJson(raw, {
              outcome: handoffState.outcome,
              allowsSuggestedUseCases: handoffState.allowSuggestedUseCases,
            })
          }
          onApply={(parsed) => applyHandoffAssembleConversation(parsed)}
          onClose={closeHandoff}
        />
      ) : null,
  };

  const dockLayoutKey = `${c.instanceId ?? 'no-id'}-${c.hasAgentGeneration}-${showRightPanel}`;

  React.useEffect(() => {
    setPromptFinaleJsMode(false);
  }, [dockLayoutKey]);

  const hasOtSections = React.useMemo(
    () => Object.values(c.structuredSectionsState).some((s) => s.storageMode === 'ot'),
    [c.structuredSectionsState]
  );

  /**
   * In modalità fullscreen forziamo la visibilità dell'header proprio dell'editor — quando il
   * portal copre l'app, il toolbar host del caller (che ospitava i pulsanti via
   * `onToolbarUpdate`) non è più visibile. Mostrando il nostro header garantiamo sempre
   * l'accesso al toggle «Riduci».
   */
  const effectiveHideHeader = hideHeader && !fullscreenPref.enabled;

  const editorBody = (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {!effectiveHideHeader && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 shrink-0"
          style={{ borderLeftColor: headerColor, borderLeftWidth: 4 }}
        >
          <Bot size={20} style={{ color: headerColor }} />
          <span className="font-semibold shrink-0">AI Agent (design-time)</span>
          {c.structuredOtEnabled ? (
            <span
              title={
                hasOtSections
                  ? 'Sezioni strutturate in modalità OT: persistenza v2 (revisionBase, opLog, currentText).'
                  : 'Flag VITE_AI_AGENT_STRUCTURED_OT attivo. Dopo Generate/Refine le sezioni useranno OT e persistenza v2.'
              }
              className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border tabular-nums ${
                hasOtSections
                  ? 'border-emerald-500/55 bg-emerald-950/45 text-emerald-200'
                  : 'border-amber-500/45 bg-amber-950/35 text-amber-200/95'
              }`}
            >
              OT{hasOtSections ? ' v2' : ''}
            </span>
          ) : null}
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="text-xs text-slate-500 truncate">Task {c.instanceId}</span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {headerAction}
              {c.hasAgentGeneration && showRightPanel ? (
                <button
                  type="button"
                  disabled={
                    c.useCaseComposerBusy ||
                    c.useCaseBundleGenerationBusy ||
                    c.useCasePhraseStylePropagationBusy ||
                    c.generating
                  }
                  onClick={() => void runGenerateUseCaseBundle()}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white"
                >
                  {c.useCaseBundleGenerationBusy || c.generating ? (
                    <Loader2 className="animate-spin" size={16} aria-hidden />
                  ) : (
                    <Sparkles size={16} aria-hidden />
                  )}
                  {c.useCaseBundleGenerationBusy || c.generating
                    ? 'Generando…'
                    : LABEL_GENERATE_USE_CASES}
                </button>
              ) : null}
              {/**
               * Toggle fullscreen: icona-only, ghost-button. Espande l'editor a tutta l'area
               * dell'app sotto la toolbar globale (vedi blocco Portal sotto). In fullscreen,
               * l'icona cambia in `Minimize2` per indicare l'azione di ritorno.
               */}
              <button
                type="button"
                onClick={fullscreenPref.toggle}
                title={
                  fullscreenPref.enabled
                    ? 'Riduci editor'
                    : 'Espandi editor a tutto schermo'
                }
                aria-label={
                  fullscreenPref.enabled
                    ? 'Riduci editor'
                    : 'Espandi editor a tutto schermo'
                }
                aria-pressed={fullscreenPref.enabled}
                className="inline-flex items-center justify-center rounded-md border border-slate-700/70 bg-slate-900/60 px-1.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                {fullscreenPref.enabled ? (
                  <Minimize2 size={14} aria-hidden />
                ) : (
                  <Maximize2 size={14} aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <AIAgentEditorDockShell
          layoutKey={dockLayoutKey}
          hasAgentGeneration={c.hasAgentGeneration}
          showRightPanel={showRightPanel}
          value={dockValue}
          generateError={c.generateError}
        />
      </div>
    </div>
  );

  /**
   * In fullscreen l'editor è proiettato in un Portal posizionato `fixed` immediatamente SOTTO
   * la toolbar globale dell'app (la coordinata è misurata via {@link useAppToolbarBottom}).
   * Z-index alto per stare sopra dock pannelli e altre chrome, ma deliberatamente più basso di
   * eventuali modali globali. Il `top` è `0` finché la toolbar non è ancora montata (es. caricamento
   * iniziale) — questo è un fallback temporaneo, l'hook aggiornerà a brevissimo.
   */
  if (fullscreenPref.enabled && typeof document !== 'undefined') {
    return createPortal(
      <div
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col bg-slate-950"
        style={{ top: appToolbarBottom ?? 0 }}
        role="region"
        aria-label="AI Agent editor a tutto schermo"
      >
        {editorBody}
      </div>,
      document.body
    );
  }

  return editorBody;
}

/**
 * Header CTA "Create / Refine Agent" with the same missing-model guard used by the other
 * AI buttons in the editor (e.g. "Crea altri use case"): if no model is configured in
 * Omnia Tutor, the click is blocked, the inline {@link MissingAiModelToast} surfaces under
 * the button, and the user is offered the "Scegli il modello" shortcut. The dock-mirrored
 * version of this CTA reuses the same guarded `onPrimaryAction` callback (no toast UI in the
 * tab toolbar — the helper opens the Settings page directly).
 */
function CreateAgentHeaderButton({
  generating,
  label,
  onPrimaryAction,
}: {
  generating: boolean;
  label: string;
  onPrimaryAction: () => void;
}): React.ReactElement {
  const { hasModel } = useAiBusyLabel();
  const [showNoModelToast, setShowNoModelToast] = React.useState(false);

  React.useEffect(() => {
    if (hasModel && showNoModelToast) {
      setShowNoModelToast(false);
    }
  }, [hasModel, showNoModelToast]);

  const handleClick = (): void => {
    if (!hasModel) {
      setShowNoModelToast(true);
      return;
    }
    onPrimaryAction();
  };

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        disabled={generating}
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium"
      >
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {generating ? LABEL_GENERATING_IA_AGENT : label}
      </button>
      {showNoModelToast ? (
        <MissingAiModelToast onDismiss={() => setShowNoModelToast(false)} />
      ) : null}
    </div>
  );
}
