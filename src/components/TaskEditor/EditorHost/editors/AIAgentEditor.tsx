/**
 * Design-time shell for AI Agent tasks: composes dockable layout, toolbar wiring, and editor hooks.
 * Domain logic lives under `./aiAgentEditor/`; this file stays a thin orchestrator.
 */
import React from 'react';
import type { EditorProps } from '../types';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { useAIProvider } from '@context/AIProviderContext';
import { Bot, Loader2, Maximize2, Minimize2, Plus, Sparkles } from 'lucide-react';
import { AI_AGENT_HEADER_COLOR, LABEL_GENERATE_USE_CASES } from './aiAgentEditor/constants';
import type { AIAgentEditorDockContextValue } from './aiAgentEditor/AIAgentEditorDockContext';
import {
  useAIAgentEditorController,
  type GenerateUseCaseBundleOutcome,
} from './aiAgentEditor/useAIAgentEditorController';
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
import {
  countConversationsByStyleId,
  listCheckedStyleIds,
} from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import { mergeAssistantPhraseDraftIntoUseCases } from './aiAgentEditor/mergeAssistantPhraseDraftIntoUseCases';
import { useAIAgentConversationActions } from './aiAgentEditor/useAIAgentConversationActions';
import { tokenizeAIAgentUseCasesApi } from '@services/aiAgentDesignApi';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { getAssistantExample } from '@types/aiAgentUseCases';
import { useFullscreenEditorPref } from './aiAgentEditor/useFullscreenEditorPref';
import { useAppToolbarBottom } from './aiAgentEditor/useAppToolbarBottom';
import { areAllUseCasesProjectable } from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';
import { ConversationalPromptDialog } from './aiAgentEditor/useCaseGeneratorWizard/ConversationalPromptDialog';
import { createPortal } from 'react-dom';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { MissingAiModelToast } from '@components/common/MissingAiModelToast';
import { LastAiCostBadge } from '@components/common/LastAiCostBadge';
import { openOmniaTutorForMissingModel } from '@utils/aiModelGuard';
import { AIAgentEditorDockProvider } from './aiAgentEditor/AIAgentEditorDockContext';
import { AIAgentWelcomeTutor } from './aiAgentEditor/constructionWizard/AIAgentWelcomeTutor';
import { AIAgentConstructionWizardShell } from './aiAgentEditor/constructionWizard/AIAgentConstructionWizardShell';
import { AIAgentDeployMenu } from './aiAgentEditor/constructionWizard/AIAgentDeployMenu';
import {
  AGENT_WIZARD_FIRST_STEP_INDEX,
  type AgentWizardStepIndex,
} from '@domain/aiAgentConstruction/agentConstructionPhase';
import {
  evaluateAgentWizardCompletion,
} from '@domain/aiAgentConstruction/agentWizardStepCompletion';
import {
  AGENT_PLATFORM_DISPLAY_LABEL,
  loadGlobalVoiceByPlatform,
  resolveVoicesByPlatform,
} from '@utils/iaAgentRuntime/globalVoiceByPlatform';
import {
  conversationConfigForConvaiApi,
  conversationConfigFragmentFromIaAgentConfig,
} from '@utils/iaAgentRuntime/convaiAgentCreatePayload';
import { createConvaiAgentViaOmniaServer } from '@services/convaiProvisionApi';
import type { IAAgentPlatform, IAAgentVoiceConfig } from 'types/iaAgentRuntimeSetup';

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
    taskLabel: typeof task?.label === 'string' ? task.label : undefined,
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

  /**
   * Sync canonico → bubble (composer Passo 1 → bolle conversazioni Passo 2).
   *
   * La filosofia del wizard è «bubble = vista del canonico» quando lo use case è reale: ogni
   * edit del messaggio agente in un posto deve riflettersi nell'altro. Il path bubble →
   * canonico è già implementato (`handleAgentCanonicalTextChange` sopra). Qui chiudiamo il
   * cerchio nell'altro verso: ogni volta che la mappa `useCaseId → assistant.content`
   * cambia (edit nel composer, regen, propaga stile, …) propaghiamo il nuovo testo a
   * tutte le bolle agente con quell'id, allineando anche la baseline diff.
   *
   * `syncBubblesToCanonicalText` è idempotente (no-op se ogni bubble è già allineata) e non
   * tocca le suggestion `pending`, quindi non c'è rischio di loop col path inverso.
   */
  const canonicalByUseCaseId = React.useMemo<Readonly<Record<string, string>>>(() => {
    const map: Record<string, string> = {};
    for (const u of c.useCases) {
      map[u.id] = getAssistantExample(u);
    }
    return map;
  }, [c.useCases]);

  const syncBubblesToCanonicalText = useCaseGenWizard.syncBubblesToCanonicalText;
  React.useEffect(() => {
    syncBubblesToCanonicalText(canonicalByUseCaseId);
  }, [canonicalByUseCaseId, syncBubblesToCanonicalText]);

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

  /**
   * Fullscreen mode: l'AI Agent editor occupa tutta l'area dell'app sotto la toolbar globale,
   * nascondendo TaskTree e ogni altra chrome circostante. Preferenza persistita in `localStorage`
   * (vedi {@link useFullscreenEditorPref}). Quando attiva, l'intero render del componente è
   * proiettato in un Portal — vedi blocco JSX finale.
   */
  const fullscreenPref = useFullscreenEditorPref();
  const appToolbarBottom = useAppToolbarBottom();

  /**
   * Side-effect post-apply per il bundle use case (replace o extend): drafts, baseline,
   * feedback, highlight dopo che il controller ha applicato il bundle generato dall'LLM.
   */
  const applyUseCaseBundleOutcome = React.useCallback(
    (result: GenerateUseCaseBundleOutcome) => {
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
    [captureUseCaseListAiBaseline]
  );

  const runGenerateUseCaseBundle = React.useCallback(async () => {
    const result = await c.handleGenerateUseCaseBundle();
    if (!result) return;
    applyUseCaseBundleOutcome(result);
  }, [c.handleGenerateUseCaseBundle, applyUseCaseBundleOutcome]);

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

  const runGeneralizeUseCaseMeta = React.useCallback(
    async (useCaseId: string) => {
      const merged = await c.handleGeneralizeUseCaseMeta(useCaseId);
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
      c.handleGeneralizeUseCaseMeta,
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
    buildCallMeta: c.buildCallMeta,
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

      /**
       * Gate v2 multi-stile: il batch genera UNA conversazione PER OGNI stile checkato,
       * in parallelo (`Promise.all`). Il gate visivo lato pannello (`wrappedAssembleConversation`
       * in `AIAgentEditorDockPanels`) ha già garantito che `checkedStyleIds.length >= 1` e
       * che ogni entry checkata sia valida; qui difendiamo comunque con un early-return.
       *
       * NB: il "batchSize per stile" del gate v1 (2–4 per outcome a saturazione) NON viene
       * più applicato — multi-stile produce naturalmente più conversazioni e l'utente è
       * già in modalità "multi-output" esplicito. Per ri-cliccare sullo stesso stile basta
       * un secondo click sul pulsante.
       */
      const checkedStyleIds = listCheckedStyleIds(c.agentConversationStyleSelections);
      if (checkedStyleIds.length === 0) {
        // Gate visuale dovrebbe averlo già bloccato; difensivo.
        return;
      }
      const stylesToRun = checkedStyleIds.slice(0, slotsLeft);

      const { outcome, allowSuggestedUseCases } = params;
      const baseCount = existing.length;
      const auto = c.agentConversationStyleAuto === true;

      /**
       * Lancio parallelo: per ogni styleId costruiamo il payload e invochiamo
       * `handleAssembleConversation`. `previousConversationsCount` cresce con `baseCount + index`
       * per dare al backend un hint di variazione mix anche se le call sono concorrenti.
       */
      const tasks = stylesToRun.map((styleId, index) => {
        const entry = c.agentConversationStyleSelections[styleId];
        return conversationActions
          .handleAssembleConversation({
            previousConversationsCount: baseCount + index,
            outcome,
            allowSuggestedUseCases,
            stylePayload: {
              id: styleId,
              description: entry?.description ?? '',
              example: entry?.example ?? '',
              auto,
            },
          })
          .then(
            (conv) => (conv ? { styleId, conv } : null),
            // handleAssembleConversation gestisce già fail() interno; qui isoliamo il reject.
            () => null
          );
      });

      const results = (await Promise.all(tasks)).filter(
        (x): x is { styleId: string; conv: UseCaseGeneratorWizardConversation } => x !== null
      );

      if (results.length === 0) return;

      /**
       * Tagging client-side dello `styleId` sulla conversazione (anche se il backend lo
       * include, ridichiariamo qui per consistenza: il payload conosce il target). Inoltre
       * aggregiamo l'append + baseline in un solo passaggio ordinato per stabilità UI.
       */
      let accumulated = [...existing];
      const perStyleCount: Record<string, number> = {};
      for (const { styleId, conv } of results) {
        const tagged: UseCaseGeneratorWizardConversation = { ...conv, styleId };
        useCaseGenWizard.appendConversation(tagged);
        accumulated = [...accumulated, tagged];
        perStyleCount[styleId] = (perStyleCount[styleId] ?? 0) + 1;
      }
      useCaseGenWizard.captureConversationsBaseline(accumulated);

      const created = results.length;
      const outcomeLabel = outcome === 'positive' ? 'positiva' : 'negativa';
      const suggestedHint = allowSuggestedUseCases ? ' (con use case emergenti ammessi)' : '';
      const breakdown = Object.entries(perStyleCount)
        .map(([id, n]) => `${n} ${id}`)
        .join(', ');
      setUseCaseBundleFeedback(
        created > 1
          ? `Montate ${created} conversazioni ${outcomeLabel}${suggestedHint} (${breakdown}). Usa i tab numerati sotto l'area di lavoro per passare dall'una all'altra.`
          : `Conversazione ${outcomeLabel} ${accumulated.length} montata${suggestedHint} (${breakdown}).`
      );
    },
    [
      conversationActions,
      useCaseGenWizard,
      c.agentConversationStyleSelections,
      c.agentConversationStyleAuto,
    ]
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
  }, [useCaseGenWizard, c.handleClearWizardOutput]);

  /**
   * Clear contestuale Passo 2: elimina solo le conversazioni montate e le loro baseline.
   * I use case e le tokenizzazioni restano intatti.
   */
  const runClearWizardConversations = React.useCallback(() => {
    useCaseGenWizard.resetConversations();
    setUseCaseBundleFeedback(null);
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
        callMeta: c.buildCallMeta(AI_CALL_PURPOSE.USE_CASE_TOKENIZE),
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

  /**
   * Sullo step Task (index 0) del wizard il pulsante «Create Agent» va reso accanto al titolo
   * dello step (vedi `AIAgentConstructionWizardShell`), NON nell'header globale dell'editor né
   * nella tab toolbar del Response Editor. È una richiesta UX per avere l'azione vicina al
   * campo descrizione che la genera. Negli altri step il pulsante non ha senso e viene soppresso.
   */
  const isWizardTaskStep = c.agentWizardCurrentStep === 0;

  const { primaryAgentActionLabel } = useAIAgentToolbarController({
    task,
    hideHeader,
    onToolbarUpdate,
    hasAgentGeneration: c.hasAgentGeneration,
    showPrimaryAgentAction: c.showPrimaryAgentAction,
    generating: c.generating,
    onPrimaryAgentAction,
    isExpanded: fullscreenPref.enabled,
    onToggleExpanded: fullscreenPref.toggle,
    suppressPrimaryAgentActionInToolbar: isWizardTaskStep,
  });

  const headerColor = AI_AGENT_HEADER_COLOR;

  /**
   * Purpose dell'azione primaria — usata sia per la busy label dinamica con modello sia per il
   * `<LastAiCostBadge>` che viene affiancato al pulsante per ~15s dopo la fine della call.
   * In modalit\u00e0 wizard step Task il purpose \u00e8 sempre `AGENT_CREATE`. In modalit\u00e0 `edit` il
   * purpose dipende dal flag legacy `hasAgentGeneration`: se la prima generazione \u00e8 gi\u00e0
   * avvenuta il pulsante diventa "Refine" e l'azione si traccia come `AGENT_REFINE`.
   */
  const primaryAgentActionPurpose = c.hasAgentGeneration ? 'AGENT_REFINE' : 'AGENT_CREATE';
  /**
   * Frase gerundio per la busy label, allineata con quanto mostrato dal pulsante in tab toolbar
   * (vedi `useAIAgentToolbarController` — analoga normalizzazione). Il modello viene aggiunto
   * automaticamente dall'hook `useAiBusyLabel` in `CreateAgentHeaderButton`.
   */
  const primaryAgentActionGerund = c.hasAgentGeneration
    ? 'Sto raffinando il task'
    : 'Sto creando il task';

  const headerAction = c.showPrimaryAgentAction ? (
    <CreateAgentHeaderButton
      generating={c.generating}
      label={primaryAgentActionLabel}
      busyGerund={primaryAgentActionGerund}
      purpose={primaryAgentActionPurpose}
      onPrimaryAction={onPrimaryAgentAction}
    />
  ) : null;

  const globalHeaderAction = isWizardTaskStep ? null : headerAction;
  const isWizardBackendStep = c.agentWizardCurrentStep === 2;
  const wizardBackendHeaderAddButton = (
    <button
      type="button"
      onClick={invokeBackendsAddManual}
      aria-label="Aggiungi backend manuale"
      title="Aggiungi una riga backend manuale in fondo all'elenco"
      className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-600/70 bg-violet-950/40 px-2 py-0.5 text-[11px] font-semibold text-violet-100 hover:bg-violet-900/55"
    >
      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Aggiungi backend
    </button>
  );
  const wizardStepHeaderAction = isWizardTaskStep
    ? headerAction
    : isWizardBackendStep
      ? wizardBackendHeaderAddButton
      : null;

  /**
   * Dialog «Crea prompt conversazionale»: state e mount risiedono nel root dell'editor (non
   * più dentro `ViewSkaGenerator`) così il bottone può vivere nella tab strip Dockview ed
   * essere accessibile da qualunque tab del gruppo destro (Use case / Dati / Agent setup /
   * Backends). La pre-condizione (`canCreate*`) è derivata: tutti gli use case devono essere
   * compilabili dal builder deterministico (`areAllUseCasesProjectable`).
   */
  const [conversationalPromptDialogOpen, setConversationalPromptDialogOpen] = React.useState(false);
  const canCreateConversationalPrompt = React.useMemo(
    () => Array.isArray(c.useCases) && c.useCases.length > 0 && areAllUseCasesProjectable(c.useCases),
    [c.useCases]
  );
  const onOpenConversationalPromptDialog = React.useCallback(() => {
    if (!canCreateConversationalPrompt) return;
    setConversationalPromptDialogOpen(true);
  }, [canCreateConversationalPrompt]);
  const onCloseConversationalPromptDialog = React.useCallback(
    () => setConversationalPromptDialogOpen(false),
    []
  );

  /**
   * ───────────────────────────────────────────────────────────────────────────────────────────
   * Top-level layout: Tutor di benvenuto → Construction Wizard (unico shell).
   * ───────────────────────────────────────────────────────────────────────────────────────────
   *
   * Post-unificazione layout: il vecchio Dockview classic è stato rimosso. Tutti i task
   * — nuovi e legacy — usano lo stesso `AIAgentConstructionWizardShell`. Il campo
   * `agentConstructionPhase` viene mantenuto sui dati persistiti per backward compat ma è
   * sempre normalizzato a `'wizard'` dal resolver (vedi
   * `domain/aiAgentConstruction/agentConstructionPhase.ts`).
   *
   * - `agentWizardCurrentStep` (persisted): 0..4. Permette riprendere dallo step lasciato.
   * - Schermata Tutor: visibile UNA volta sola, controllata dal flag persistito
   *   `agentWizardTutorAcknowledged`. Per i task legacy con `hasAgentGeneration=true` lo
   *   snapshot lo forza a `true` (i veterani non rivedono l'onboarding).
   * - `completion[]` serve a colorare gli step ✅ nello stepper. Per i veterani gli step
   *   incompleti restano comunque navigabili (vedi `bypassGating` dello stepper).
   */
  const completion = React.useMemo(
    () =>
      evaluateAgentWizardCompletion({
        descriptionTrimmed: c.designDescription.trim(),
        useCaseCount: c.useCases.length,
        conversationCount: useCaseGenWizard.conversations.length,
      }),
    [c.designDescription, c.useCases.length, useCaseGenWizard.conversations.length]
  );
  /**
   * Schermata Tutor: si mostra solo se l'utente non ha ancora cliccato «Cominciamo».
   * `agentWizardTutorAcknowledged` per i task legacy è già forzato a `true` dallo
   * snapshot loader, quindi i veterani non la vedono mai (vedi `buildTaskSnapshotFromRaw`).
   */
  const showWelcomeTutor = !c.agentWizardTutorAcknowledged;

  const stepSetter = c.setAgentWizardCurrentStep;
  const ackTutor = c.acknowledgeAgentWizardTutor;
  /**
   * Vista "Costi" del task (pulsante separato nello stepper, non gating). \u00c8 uno stato
   * volatile della sessione (NON persistito): ha senso che ogni nuova apertura del task
   * riparta dallo step di costruzione, non da una pagina di reportistica. Si attiva/disattiva
   * cliccando il pulsante "$" oppure cliccando uno qualunque degli step ufficiali (1..5).
   */
  const [costsViewActive, setCostsViewActive] = React.useState(false);
  const onSelectWizardStep = React.useCallback(
    (next: AgentWizardStepIndex) => {
      setCostsViewActive(false);
      stepSetter(next);
    },
    [stepSetter]
  );
  const onSelectCostsView = React.useCallback(() => {
    setCostsViewActive(true);
  }, []);
  /**
   * Click di «Cominciamo» nella Tutor:
   * 1. attiva l'animazione di uscita della Tutor (`tutorExiting=true`, ~400ms);
   * 2. al termine dell'animazione: marca la Tutor come vista (one-shot, persistito), forza
   *    l'indice step al primo, attiva il glow viola transitorio sul pulsante Step 1.
   *
   * I 400ms sono allineati alla durata della transizione CSS in `AIAgentWelcomeTutor`.
   */
  const TUTOR_EXIT_MS = 400;
  const [tutorExiting, setTutorExiting] = React.useState(false);
  const [recentlyEnteredWizard, setRecentlyEnteredWizard] = React.useState(false);
  const tutorExitTimerRef = React.useRef<number | null>(null);
  const onStartFromTutor = React.useCallback(() => {
    if (tutorExiting) return;
    setTutorExiting(true);
    tutorExitTimerRef.current = window.setTimeout(() => {
      ackTutor();
      stepSetter(AGENT_WIZARD_FIRST_STEP_INDEX);
      setRecentlyEnteredWizard(true);
      setTutorExiting(false);
      tutorExitTimerRef.current = null;
    }, TUTOR_EXIT_MS);
  }, [ackTutor, stepSetter, tutorExiting]);

  React.useEffect(() => {
    return () => {
      if (tutorExitTimerRef.current !== null) {
        window.clearTimeout(tutorExitTimerRef.current);
      }
    };
  }, []);

  /**
   * Effetto «glow viola persistente» sul pulsante Step 1 dello Stepper subito dopo l'uscita
   * dalla Tutor: dura 4 secondi poi si spegne. Non persistito (\u00e8 un effetto puramente
   * visivo legato alla transizione di sessione). Auto-cleanup al unmount del timer.
   */
  React.useEffect(() => {
    if (!recentlyEnteredWizard) return;
    const t = window.setTimeout(() => setRecentlyEnteredWizard(false), 4000);
    return () => window.clearTimeout(t);
  }, [recentlyEnteredWizard]);

  /**
   * ─────────────────────────────────────────────────────────────────────────────────────────
   * Deploy menu (dropdown «Deploy» nello stepper, visibile solo a wizard completato).
   * ─────────────────────────────────────────────────────────────────────────────────────────
   *
   * Strategia: il dropdown è il punto di ingresso per due famiglie di azioni:
   *  1) «Upload to Platform» → provisioning vero (oggi solo ElevenLabs è cablato; gli altri
   *     mostrano un alert informativo perché Anthropic / Gemini non hanno un concetto nativo
   *     di "agent persistente" e OpenAI Assistants non è ancora integrato).
   *  2) «Copy system prompt» → riusa il dialog «Crea prompt conversazionale» già esistente.
   *
   * La mappa voci-per-platform è ricaricata tramite un seed reattivo (`voicesReloadSeed`):
   * dopo un «Fix» bumpiamo il seed così quando l'utente torna allo stepper la mappa è
   * aggiornata senza dover montare/smontare il componente.
   */
  const [voicesReloadSeed, setVoicesReloadSeed] = React.useState(0);
  /**
   * Mappa platform → voce visualizzata nel deploy menu, secondo la regola B1/C1
   * concordata col designer:
   *   1) configurazione GENERALE per la platform (`loadGlobalVoiceByPlatform[platform]`);
   *   2) altrimenti, la voce dell'**override del task editor** SE la sua `platform`
   *      coincide con quella richiesta;
   *   3) altrimenti `null` → la riga del menu mostra «Manca la voce – Fix».
   *
   * Il resolver è puro (`resolveVoicesByPlatform`); qui ci limitiamo a passargli
   * lo snapshot dell'override task corrente (`c.iaRuntimeConfig`).
   */
  const voicesByPlatform = React.useMemo(
    () =>
      resolveVoicesByPlatform(loadGlobalVoiceByPlatform(), {
        platform: c.iaRuntimeConfig?.platform ?? null,
        voice: c.iaRuntimeConfig?.voice ?? null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed forza ricalcolo on demand
    [voicesReloadSeed, c.iaRuntimeConfig?.platform, c.iaRuntimeConfig?.voice]
  );

  /**
   * «Fix voice» per piattaforma X: l'utente clicca sul «Fix» di una riga platform nel deploy
   * menu perché manca la voce. Comportamento concordato col designer (C / C2):
   *
   *   1. Cambiamo la `platform` dell'**override del task editor** a X, preservando tutti gli
   *      altri campi (system prompt, tools, ecc.). Il pannello dello step 5 monta `IAAgentSetup`,
   *      che renderizza le pill platform basate su `iaRuntimeConfig.platform`: questo è l'unico
   *      modo per «selezionare la TAB» della platform giusta quando il pannello si apre.
   *      NB: il cambio platform è persistente (override task). La voce eventualmente già
   *      configurata sulla platform precedente NON viene cancellata: resta dentro `voice` /
   *      `ttsModel` e tornerà visibile se l'utente ripristina la platform precedente.
   *   2. Saltiamo allo step 5 («Voce») del wizard.
   *   3. Dispatch dell'evento `omnia:ia-runtime-focus` con `focus: 'voice'` → il pannello fa
   *      scroll-into-view sulla sezione voce.
   *   4. Bumpiamo `voicesReloadSeed` così quando l'utente torna allo stepper la mappa voci
   *      del deploy menu si rinfresca.
   */
  const onFixVoiceForPlatform = React.useCallback(
    (platform: IAAgentPlatform) => {
      const currentCfg = c.iaRuntimeConfig;
      if (currentCfg && currentCfg.platform !== platform) {
        const merged = { ...currentCfg, platform };
        c.setIaRuntimeConfig(merged);
        c.persistIaRuntimeOverrideSnapshot({ platform });
      }
      onSelectWizardStep(4 as AgentWizardStepIndex);
      window.setTimeout(() => {
        document.dispatchEvent(
          new CustomEvent('omnia:ia-runtime-focus', {
            detail: { taskInstanceId: instanceId, focus: 'voice' },
          })
        );
        setVoicesReloadSeed((s) => s + 1);
      }, 250);
    },
    [
      instanceId,
      onSelectWizardStep,
      c.iaRuntimeConfig,
      c.setIaRuntimeConfig,
      c.persistIaRuntimeOverrideSnapshot,
    ]
  );

  /**
   * «Upload to Platform → Platform X». Provisioning reale solo per ElevenLabs (createAgent
   * ConvAI esistente). Per le altre 3 platform: alert informativo che spiega perché non è
   * disponibile, evitando false aspettative (regola progetto: fail-loud, no silent fallback).
   */
  const onUploadToPlatform = React.useCallback(
    async (platform: IAAgentPlatform, voice: IAAgentVoiceConfig) => {
      const platformLabel = AGENT_PLATFORM_DISPLAY_LABEL[platform];
      if (platform !== 'elevenlabs') {
        window.alert(
          `Provisioning verso ${platformLabel} non ancora implementato.\n\n` +
            (platform === 'openai'
              ? 'OpenAI Assistants API è prevista come prossima integrazione.'
              : `${platformLabel} non espone un concetto nativo di "agent persistente": ` +
                'usa «Copy system prompt» per portare il prompt manualmente nella console.')
        );
        return;
      }
      try {
        // Costruisco la conversation_config a partire dall'IAAgentConfig del task corrente,
        // forzando la voce scelta nel dropdown (single source: la voce è la default GLOBALE
        // per la platform target, non quella del task — sono concetti separati).
        const cfgWithVoice = { ...c.iaRuntimeConfig, platform: 'elevenlabs' as const, voice };
        const fragment = conversationConfigFragmentFromIaAgentConfig(cfgWithVoice);
        if (!fragment) {
          throw new Error('IA Runtime config insufficiente per generare il payload ConvAI');
        }
        const outbound = conversationConfigForConvaiApi(fragment) ?? fragment;
        const displayName =
          (typeof task?.label === 'string' && task.label.trim()) ||
          `Omnia agent ${instanceId.slice(0, 8)}`;
        const { agentId } = await createConvaiAgentViaOmniaServer({
          name: displayName,
          conversation_config: outbound,
        });
        window.alert(
          `Deploy ${platformLabel} riuscito.\nAgent ID: ${agentId}\nVoce: ${voice.id}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        window.alert(`Deploy ${platformLabel} fallito:\n\n${msg}`);
      }
    },
    [c.iaRuntimeConfig, instanceId, task?.label]
  );

  /**
   * Slot del dropdown «Deploy» nello stepper: presente appena gli use case sono pronti
   * (compilabili dal builder deterministico, vedi `canCreateConversationalPrompt`).
   * Le conversazioni NON sono prerequisito di Upload: l'Upload pubblica il prompt
   * runtime dell'agente; le conversazioni restano un artefatto di review opzionale.
   * Il flag `costsActive` non lo nasconde — resta accessibile anche dalla vista Costi.
   */
  /**
   * Stili disponibili nel menu Deploy = stili checkati nel gate conversazionale.
   * Sono solo informativi/opzionali: non bloccano l'Upload (vedi `AIAgentDeployMenu`).
   * I badge mostrano quante conversazioni esistono per quello stile, se presenti.
   */
  const deployAvailableStyleIds = React.useMemo(
    () => listCheckedStyleIds(c.agentConversationStyleSelections),
    [c.agentConversationStyleSelections]
  );
  const deployCountByStyleId = React.useMemo(
    () => countConversationsByStyleId(useCaseGenWizard.conversations),
    [useCaseGenWizard.conversations]
  );

  /**
   * Auto-reset del `deployStyleId` quando lo stile selezionato non è più checkato.
   * Le conversazioni non sono più un prerequisito di Upload, quindi il check è solo
   * sulla coerenza con la lista degli stili attivi nel gate.
   * Idempotente: niente effetto se `deployStyleId` è già valido o `null`.
   */
  React.useEffect(() => {
    const current = c.agentConversationDeployStyleId;
    if (current && !deployAvailableStyleIds.includes(current)) {
      c.setAgentConversationDeployStyleId(null);
    }
  }, [
    deployAvailableStyleIds,
    c.agentConversationDeployStyleId,
    c.setAgentConversationDeployStyleId,
  ]);

  const deploySlot: React.ReactNode = canCreateConversationalPrompt ? (
    <AIAgentDeployMenu
      voicesByPlatform={voicesByPlatform}
      onUploadToPlatform={(platform, voice) => {
        void onUploadToPlatform(platform, voice);
      }}
      onFixVoice={onFixVoiceForPlatform}
      onCopySystemPrompt={onOpenConversationalPromptDialog}
      copySystemPromptDisabled={!canCreateConversationalPrompt}
      copySystemPromptDisabledReason="Disponibile quando tutti gli use case sono compilabili (frase canonica presente)."
      availableStyleIds={deployAvailableStyleIds}
      countByStyleId={deployCountByStyleId}
      deployStyleId={c.agentConversationDeployStyleId}
      onDeployStyleIdChange={c.setAgentConversationDeployStyleId}
      logUseCaseEnabled={c.agentLogUseCase}
      onToggleLogUseCase={c.setAgentLogUseCase}
      immediateStartEnabled={c.agentImmediateStart}
      onToggleImmediateStart={c.setAgentImmediateStart}
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
    onGeneralizeUseCaseMeta: runGeneralizeUseCaseMeta,
    onRegenerateAgentMessage: c.handleRegenerateAgentMessage,
    onAnnotateAgentMessageForJson: c.handleAnnotateAgentMessageForJson,
    onDeleteUseCase: c.handleDeleteUseCase,
    useCaseGlobalStyleId: c.useCaseGlobalStyleId,
    setUseCaseGlobalStyleId: c.setUseCaseGlobalStyleId,
    agentUseCaseStyleLearningNotes: c.agentUseCaseStyleLearningNotes,
    setAgentUseCaseStyleLearningNotes: c.setAgentUseCaseStyleLearningNotes,
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
    hideBackendsPanelInlineAddButton: c.agentWizardCurrentStep === 2,

    useCaseGeneratorWizard: useCaseGenWizard,

    useCaseBundleFeedback,
    onDismissUseCaseBundleFeedback: dismissUseCaseBundleFeedback,
    useCaseHighlightIds,
    onClearUseCaseHighlight: clearUseCaseHighlight,

    onPropagateExamplePhraseStyle: runPropagateExamplePhraseStyle,
    onCompleteCorrection: c.handleCompleteCorrection,
    assistantPhraseStyleNewIds,
    onAssistantPhraseDraftChange,

    useCaseSiblingSortMode: c.useCaseSiblingSortMode,
    setUseCaseSiblingSortMode: c.setUseCaseSiblingSortMode,
    reorderUseCaseSiblingByDrag: c.reorderUseCaseSiblingByDrag,

    onAssembleConversation: runAssembleConversation,
    assembleConversationBusy: conversationActions.assembleConversationBusy,
    onProofreadConversationAgentTurns: runProofreadConversationAgentTurns,
    proofreadConversationBusy: conversationActions.proofreadConversationBusy,
    onPromoteSuggestionToCatalog: runPromoteSuggestionToCatalog,
    onRejectSuggestion: runRejectSuggestion,
    onTokenizeUseCases: runTokenizeUseCases,
    tokenizeUseCasesBusy,
    tokenizedByUseCaseId,
    onClearAllWizardOutput: runClearAllWizardOutput,
    onClearWizardConversations: runClearWizardConversations,
    onClearWizardTokenization: runClearWizardTokenization,

    canCreateConversationalPrompt,
    onOpenConversationalPromptDialog,

    agentConversationStyleExample: c.agentConversationStyleExample,
    setAgentConversationStyleExample: c.setAgentConversationStyleExample,
    agentConversationStyleAuto: c.agentConversationStyleAuto,
    setAgentConversationStyleAuto: c.setAgentConversationStyleAuto,
    agentConversationStyleSelections: c.agentConversationStyleSelections,
    setAgentConversationStyleSelections: c.setAgentConversationStyleSelections,
    agentConversationDeployStyleId: c.agentConversationDeployStyleId,
    setAgentConversationDeployStyleId: c.setAgentConversationDeployStyleId,
    agentLogUseCase: c.agentLogUseCase,
    setAgentLogUseCase: c.setAgentLogUseCase,

    useCasePropagatorProvider: provider,
    useCasePropagatorModel: typeof model === 'string' ? model : '',
    useCasePropagatorGlobalStyleContract: c.globalStyleContract,
    buildUseCasePropagatorCallMeta: (purpose: string) => ({
      purpose,
      taskId: typeof c.instanceId === 'string' && c.instanceId ? c.instanceId : undefined,
      taskLabel: typeof task?.label === 'string' && task.label ? task.label : undefined,
    }),
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

  /**
   * Vincolo larghezza minima del Task Editor AI Agent (720 px). Sotto questa soglia il layout
   * interno del Construction Wizard (specialmente lo step Conversazione con la lista use case
   * + guida laterale) si comprime fino a far sparire i pannelli. Per evitare la regressione
   * UX usiamo `min-w-[720px]` sull'inner-body e `overflow-x-auto` sul wrapper esterno: se il
   * pannello Dockview esterno è più stretto di 720px (es. utente lo trascina o lo splitta in
   * verticale), appare una scrollbar orizzontale invece di un layout rotto.
   */
  const editorInner = (
    <div className="h-full w-full flex flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden min-w-[720px]">
      {!effectiveHideHeader && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 shrink-0 dark:border-slate-800"
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
            <span className="text-xs text-slate-600 truncate dark:text-slate-500">Task {c.instanceId}</span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {globalHeaderAction}
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
                className="inline-flex items-center justify-center rounded-md border border-slate-300/90 bg-white/90 px-1.5 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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

      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        {/*
          Layout top-level (post-unificazione): due sole viste mutuamente esclusive.
          - Tutor di benvenuto: solo al primo accesso di un task vergine.
          - Construction Wizard: unico shell del Task Editor AI Agent. I pannelli interni
            (Editor*Panel) leggono dallo stesso `dockValue` via `AIAgentEditorDockProvider`,
            single source of truth.
          Per i veterani (`hasAgentGeneration === true`) il flag `agentWizardTutorAcknowledged`
          è già forzato a `true` dallo snapshot loader, quindi cadono direttamente nello
          stepper senza vedere la Tutor.
        */}
        {showWelcomeTutor || tutorExiting ? (
          <AIAgentWelcomeTutor onStart={onStartFromTutor} isExiting={tutorExiting} />
        ) : (
          <AIAgentEditorDockProvider value={dockValue}>
            <AIAgentConstructionWizardShell
              currentStep={c.agentWizardCurrentStep}
              completion={completion}
              onSelectStep={onSelectWizardStep}
              glowStepIndex={recentlyEnteredWizard ? AGENT_WIZARD_FIRST_STEP_INDEX : null}
              stepHeaderAction={costsViewActive ? null : wizardStepHeaderAction}
              costsActive={costsViewActive}
              onSelectCosts={onSelectCostsView}
              taskId={instanceId}
              taskLabel={typeof task?.label === 'string' ? task.label : ''}
              deploySlot={deploySlot}
              bypassGating={c.hasAgentGeneration}
            />
          </AIAgentEditorDockProvider>
        )}
        {/*
          Dialog «Crea prompt conversazionale»: confinato al rettangolo dell'editor (non
          viewport) — sta sopra al dock ma sotto la chrome esterna. Usa portal interno via
          `absolute inset-0 z-[60]` (vedi `ConversationalPromptDialog`).
        */}
        <ConversationalPromptDialog
          open={conversationalPromptDialogOpen}
          useCases={c.useCases}
          includeLog={c.agentLogUseCase}
          onClose={onCloseConversationalPromptDialog}
        />
      </div>
    </div>
  );

  /**
   * Wrapper esterno con `overflow-x-auto`: se il pannello Dockview che ospita l'editor è
   * più stretto di 720px, appare una scrollbar orizzontale interna invece di un layout
   * compresso/rotto. `overflow-y-hidden` evita doppia scrollbar verticale (quella interna
   * dei pannelli del wizard rimane attiva).
   */
  const editorBody = (
    <div className="h-full w-full overflow-x-auto overflow-y-hidden bg-slate-100 dark:bg-slate-950">
      {editorInner}
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
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-950"
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
  busyGerund,
  purpose,
  onPrimaryAction,
}: {
  generating: boolean;
  label: string;
  /** Frase gerundio della busy label (es. `"Sto creando il task"`). */
  busyGerund: string;
  /** AI_CALL_PURPOSE id usato sia per la busy label che per il `<LastAiCostBadge>`. */
  purpose: string;
  onPrimaryAction: () => void;
}): React.ReactElement {
  const { hasModel, busyLabel } = useAiBusyLabel();
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
      <div className="flex items-center">
        <button
          type="button"
          disabled={generating}
          onClick={handleClick}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {/*
            Busy label: durante la generazione mostra il gerundio + modello (es. "Sto creando il
            task (gpt-5)..."). Fuori dalla generazione mostra la label statica (Create / Refine).
          */}
          {generating ? busyLabel(busyGerund) : label}
        </button>
        {/*
          Dopo ogni call, per ~15s (vedi `LastAiCostBadge.WINDOW_MS`), mostra "Last $X.XX" / "EUR Y"
          accanto al pulsante. Il purpose deve corrispondere al `purpose` propagato in `callMeta`
          dal `handleGenerate` controller: per Create Agent \u00e8 `AGENT_CREATE`, per Refine `AGENT_REFINE`.
        */}
        {!generating ? <LastAiCostBadge purpose={purpose} /> : null}
      </div>
      {showNoModelToast ? (
        <MissingAiModelToast onDismiss={() => setShowNoModelToast(false)} />
      ) : null}
    </div>
  );
}
