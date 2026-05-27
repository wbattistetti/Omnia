/**
 * Wizard use case nel portale review: stesso shell/pipeline di Omnia, persistenza su canale condiviso.
 */

import * as React from 'react';
import { useAIProvider } from '@context/AIProviderContext';
import type { AIAgentEditorDockContextValue } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import { mergeAssistantPhraseDraftIntoUseCases } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/mergeAssistantPhraseDraftIntoUseCases';
import { useUseCaseGeneratorWizard } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useCaseGeneratorWizard/useUseCaseGeneratorWizard';
import { useAIAgentConversationActions } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useAIAgentConversationActions';
import type { UseCaseGeneratorWizardStepId } from '@domain/useCaseGeneratorWizard/types';
import { USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS } from '@domain/useCaseGeneratorWizard/registry';
import type { UseCaseGeneratorWizardConversation } from '@domain/useCaseGeneratorWizard/types';
import { compileUseCaseConversationalText } from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';
import { listCheckedStyleIds } from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import type { ConversationStyleSelections } from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import { getAssistantExample, type AIAgentUseCase } from '@types/aiAgentUseCases';
import { applyAllDesignerVotesUp } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useCaseComposerDesignerVotes';
import { normalizeUseCaseSiblingOrder } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useCaseHierarchy';
import { propagateExamplePhraseStyleApi, tokenizeAIAgentUseCasesApi } from '@services/aiAgentDesignApi';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { resolveAiAgentOutputLanguage } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/resolveAiAgentOutputLanguage';
import type { ReviewAgentIaDockSlice } from './useReviewAgentIaDockSlice';

export type ReviewWizardDockSlice = Pick<
  AIAgentEditorDockContextValue,
  | 'useCaseGeneratorWizard'
  | 'useCaseBundleFeedback'
  | 'onDismissUseCaseBundleFeedback'
  | 'useCaseHighlightIds'
  | 'onClearUseCaseHighlight'
  | 'onPropagateExamplePhraseStyle'
  | 'assistantPhraseStyleNewIds'
  | 'onAssistantPhraseDraftChange'
  | 'onAssembleConversation'
  | 'assembleConversationBusy'
  | 'onProofreadConversationAgentTurns'
  | 'proofreadConversationBusy'
  | 'onPromoteSuggestionToCatalog'
  | 'onRejectSuggestion'
  | 'onTokenizeUseCases'
  | 'tokenizeUseCasesBusy'
  | 'tokenizedByUseCaseId'
  | 'onClearAllWizardOutput'
  | 'onClearWizardConversations'
  | 'onClearWizardTokenization'
  | 'useCasePhraseStylePropagationBusy'
  | 'useCasePhraseStyleBatchProgress'
  | 'onRootUseCaseBatchCreated'
>;

export interface UseReviewWizardDockIntegrationParams {
  taskInstanceId: string;
  channelLoaded: boolean;
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  composedRuntimeMarkdown: string;
  globalStyleContract: string;
  useCaseGlobalStyleId: string;
  agentConversationStyleSelections: ConversationStyleSelections;
  agentConversationStyleAuto: boolean;
  agentUseCaseWizardStateJson: string;
  persistAgentUseCaseWizardState: (json: string) => void;
  buildCallMeta: ReviewAgentIaDockSlice['buildCallMeta'];
  onCreateUseCase: AIAgentEditorDockContextValue['onCreateUseCase'];
  onComposerIaError: (message: string) => void;
}

/** Wizard pipeline + handlers IA allineati a {@link AIAgentEditor}. */
export function useReviewWizardDockIntegration(
  params: UseReviewWizardDockIntegrationParams
): ReviewWizardDockSlice {
  const { provider, model } = useAIProvider();

  const [assistantPhraseDraftById, setAssistantPhraseDraftById] = React.useState<
    Record<string, string>
  >({});
  const [useCaseBundleFeedback, setUseCaseBundleFeedback] = React.useState<string | null>(null);
  const [useCaseHighlightIds, setUseCaseHighlightIds] = React.useState<readonly string[]>([]);
  const [assistantPhraseStyleNewIds, setAssistantPhraseStyleNewIds] = React.useState<
    readonly string[]
  >([]);
  const [useCasePhraseStylePropagationBusy, setUseCasePhraseStylePropagationBusy] =
    React.useState(false);
  const [useCasePhraseStyleBatchProgress, setUseCasePhraseStyleBatchProgress] = React.useState<{
    current: number;
    total: number;
  } | null>(null);
  const [tokenizeUseCasesBusy, setTokenizeUseCasesBusy] = React.useState(false);

  React.useEffect(() => {
    setAssistantPhraseDraftById({});
  }, [params.taskInstanceId]);

  const useCasesForWizardStylePlan = React.useMemo(
    () => mergeAssistantPhraseDraftIntoUseCases(params.useCases, assistantPhraseDraftById),
    [params.useCases, assistantPhraseDraftById]
  );

  const handleAgentCanonicalTextChange = React.useCallback(
    (useCaseId: string, text: string) => {
      params.setUseCases((prev) =>
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
    [params.setUseCases]
  );

  const onUseCaseTokenizedTextChangeRef = React.useRef<(useCaseId: string, t: string) => void>(
    () => {}
  );
  const onUseCaseTokenizedTextChangeStable = React.useCallback(
    (useCaseId: string, t: string) => onUseCaseTokenizedTextChangeRef.current(useCaseId, t),
    []
  );

  const onConfirmAdvanceWithoutEdits = React.useCallback((stepId: UseCaseGeneratorWizardStepId) => {
    if (stepId !== 'use_case_list') return;
    params.setUseCases((prev) => applyAllDesignerVotesUp(prev));
  }, [params.setUseCases]);

  const useCaseGenWizard = useUseCaseGeneratorWizard({
    instanceId: params.taskInstanceId,
    useCases: useCasesForWizardStylePlan,
    taskPersistedWizardJson: params.agentUseCaseWizardStateJson,
    onWizardPersist: params.persistAgentUseCaseWizardState,
    onConfirmAdvanceWithoutEdits,
    onAgentCanonicalTextChange: handleAgentCanonicalTextChange,
    onUseCaseTokenizedTextChange: onUseCaseTokenizedTextChangeStable,
  });

  const canonicalByUseCaseId = React.useMemo<Readonly<Record<string, string>>>(() => {
    const map: Record<string, string> = {};
    for (const u of params.useCases) {
      map[u.id] = getAssistantExample(u);
    }
    return map;
  }, [params.useCases]);

  const syncBubblesToCanonicalText = useCaseGenWizard.syncBubblesToCanonicalText;
  React.useEffect(() => {
    syncBubblesToCanonicalText(canonicalByUseCaseId);
  }, [canonicalByUseCaseId, syncBubblesToCanonicalText]);

  React.useEffect(() => {
    if (useCaseGenWizard.currentStepId !== 'use_case_list') {
      setAssistantPhraseStyleNewIds([]);
    }
  }, [useCaseGenWizard.currentStepId]);

  const conversationActions = useAIAgentConversationActions({
    provider,
    model,
    useCases: params.useCases,
    runtimeContext: params.composedRuntimeMarkdown,
    globalStyleContract: params.globalStyleContract,
    buildCallMeta: params.buildCallMeta,
    onError: (msg) => setUseCaseBundleFeedback(msg),
  });

  const runPropagateExamplePhraseStyle = React.useCallback(async () => {
    const plan = useCaseGenWizard.examplePhraseStylePlan;
    if (!plan.showStyleCta) return;
    const { styleExampleUseCaseIds, targetIds } = plan;
    if (styleExampleUseCaseIds.length === 0 || targetIds.length === 0) return;
    setUseCasePhraseStylePropagationBusy(true);
    const targets = [...targetIds];
    const total = targets.length;
    setUseCasePhraseStyleBatchProgress(total > 0 ? { current: 1, total } : null);
    try {
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const byContent = new Map<string, string>();
      for (let i = 0; i < targets.length; i += 1) {
        setUseCasePhraseStyleBatchProgress({ current: i + 1, total });
        const res = await propagateExamplePhraseStyleApi({
          allUseCases: params.useCases,
          logicalSteps: [],
          styleExampleUseCaseIds: [...styleExampleUseCaseIds],
          targetUseCaseIds: [targets[i]],
          provider,
          model,
          outputLanguage,
          globalStyleContract: params.globalStyleContract,
          globalStyleId: params.useCaseGlobalStyleId,
          callMeta: params.buildCallMeta('USE_CASE_PROPAGATE_STYLE'),
        });
        for (const row of res.updates) {
          byContent.set(row.use_case_id, row.assistant_content);
        }
      }
      const nextUseCases = normalizeUseCaseSiblingOrder(
        params.useCases.map((u) => {
          const newContent = byContent.get(u.id);
          if (newContent === undefined) return u;
          const turnId = u.dialogue.find((t) => t.role === 'assistant')?.turn_id;
          if (!turnId) return u;
          return {
            ...u,
            dialogue: u.dialogue.map((t) =>
              t.turn_id === turnId && t.role === 'assistant'
                ? { ...t, content: newContent, motor_snapshot: undefined }
                : t
            ),
            designer_edit_confirmed: true as const,
          };
        }),
        'dialogue'
      );
      params.setUseCases(nextUseCases);
      setAssistantPhraseDraftById({});
      useCaseGenWizard.captureExamplePhrasesBaseline(nextUseCases);
      setAssistantPhraseStyleNewIds(targets.filter((id) => byContent.has(id)));
      setUseCaseBundleFeedback('Messaggi aggiornati con il nuovo stile.');
    } catch (e) {
      params.onComposerIaError(e instanceof Error ? e.message : String(e));
    } finally {
      setUseCasePhraseStylePropagationBusy(false);
      setUseCasePhraseStyleBatchProgress(null);
    }
  }, [
    useCaseGenWizard,
    params.useCases,
    params.setUseCases,
    params.globalStyleContract,
    params.useCaseGlobalStyleId,
    params.buildCallMeta,
    provider,
    model,
    params.onComposerIaError,
  ]);

  const runAssembleConversation = React.useCallback(
    async (assembleParams: {
      outcome: 'positive' | 'negative';
      allowSuggestedUseCases: boolean;
    }) => {
      const existing = useCaseGenWizard.conversations;
      const slotsLeft = USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS - existing.length;
      if (slotsLeft <= 0) return;
      const checkedStyleIds = listCheckedStyleIds(params.agentConversationStyleSelections);
      if (checkedStyleIds.length === 0) return;
      const stylesToRun = checkedStyleIds.slice(0, slotsLeft);
      const { outcome, allowSuggestedUseCases } = assembleParams;
      const baseCount = existing.length;
      const auto = params.agentConversationStyleAuto === true;
      const tasks = stylesToRun.map((styleId, index) => {
        const entry = params.agentConversationStyleSelections[styleId];
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
            () => null
          );
      });
      const results = (await Promise.all(tasks)).filter(
        (x): x is { styleId: string; conv: UseCaseGeneratorWizardConversation } => x !== null
      );
      if (results.length === 0) return;
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
          ? `Montate ${created} conversazioni ${outcomeLabel}${suggestedHint} (${breakdown}).`
          : `Conversazione ${outcomeLabel} ${accumulated.length} montata${suggestedHint} (${breakdown}).`
      );
    },
    [
      conversationActions,
      useCaseGenWizard,
      params.agentConversationStyleSelections,
      params.agentConversationStyleAuto,
    ]
  );

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
    const nextAll = useCaseGenWizard.conversations.map((c) =>
      c.conversationId === next.conversationId ? next : c
    );
    useCaseGenWizard.captureConversationsBaseline(nextAll);
    for (const t of next.turns) {
      if (t.role !== 'agent') continue;
      if (t.suggestion) continue;
      handleAgentCanonicalTextChange(t.useCaseId, t.text);
    }
    setUseCaseBundleFeedback('Frasi modificate corrette (ortografia).');
  }, [conversationActions, useCaseGenWizard, handleAgentCanonicalTextChange]);

  const runPromoteSuggestionToCatalog = React.useCallback(
    async (conversationId: string, turnId: string) => {
      const conv = useCaseGenWizard.conversations.find((cn) => cn.conversationId === conversationId);
      if (!conv) return;
      const turn = conv.turns.find((t) => t.turnId === turnId);
      if (!turn || turn.role !== 'agent' || !turn.suggestion || turn.suggestion.status !== 'pending') {
        return;
      }
      try {
        const newUseCaseId = await params.onCreateUseCase({
          label: turn.suggestion.proposedLabel,
          parentId: null,
          creationScope: 'single',
        });
        handleAgentCanonicalTextChange(newUseCaseId, turn.text);
        useCaseGenWizard.promoteSuggestionToCanonical(
          conversationId,
          turnId,
          newUseCaseId,
          turn.suggestion.proposedLabel
        );
        setUseCaseBundleFeedback(`Use case «${turn.suggestion.proposedLabel}» aggiunto al catalogo.`);
      } catch (err) {
        setUseCaseBundleFeedback(
          `Errore durante la promozione: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    [params.onCreateUseCase, handleAgentCanonicalTextChange, useCaseGenWizard]
  );

  const runRejectSuggestion = React.useCallback(
    (conversationId: string, turnId: string) => {
      useCaseGenWizard.setSuggestionStatus(conversationId, turnId, 'rejected');
      setUseCaseBundleFeedback('Suggerimento scartato.');
    },
    [useCaseGenWizard]
  );

  const handleUseCaseTokenizedTextChange = React.useCallback(
    (useCaseId: string, tokenizedText: string) => {
      params.setUseCases((prev) =>
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
    [params.setUseCases]
  );

  React.useEffect(() => {
    onUseCaseTokenizedTextChangeRef.current = handleUseCaseTokenizedTextChange;
  }, [handleUseCaseTokenizedTextChange]);

  const runTokenizeUseCases = React.useCallback(async () => {
    if (tokenizeUseCasesBusy) return;
    const candidates = params.useCases.filter((u) => getAssistantExample(u).trim().length > 0);
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
        callMeta: params.buildCallMeta(AI_CALL_PURPOSE.USE_CASE_TOKENIZE),
      });
      if (res.updates.length === 0) return;
      const byId = new Map(res.updates.map((u) => [u.useCaseId, u.tokenizedText]));
      let nextUseCases: AIAgentUseCase[] = [];
      params.setUseCases((prev) => {
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
  }, [tokenizeUseCasesBusy, params.setUseCases, params.useCases, provider, model, useCaseGenWizard, params.buildCallMeta]);

  const runClearAllWizardOutput = React.useCallback(() => {
    useCaseGenWizard.resetAll();
    params.setUseCases((prev) =>
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
    setAssistantPhraseDraftById({});
    setAssistantPhraseStyleNewIds([]);
    setUseCaseBundleFeedback(null);
    setUseCaseHighlightIds([]);
  }, [useCaseGenWizard, params.setUseCases]);

  const runClearWizardConversations = React.useCallback(() => {
    useCaseGenWizard.resetConversations();
    setUseCaseBundleFeedback(null);
  }, [useCaseGenWizard]);

  const runClearWizardTokenization = React.useCallback(() => {
    useCaseGenWizard.resetTokenization();
    params.setUseCases((prev) =>
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
  }, [useCaseGenWizard, params.setUseCases]);

  const tokenizedByUseCaseId = React.useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const u of params.useCases) {
      const compiled = compileUseCaseConversationalText(u);
      if (compiled?.tokenizedText) {
        out[u.id] = compiled.tokenizedText;
      }
    }
    return out;
  }, [params.useCases]);

  const onRootUseCaseBatchCreated = React.useCallback((createdIds: readonly string[]) => {
    if (createdIds.length === 0) return;
    setUseCaseHighlightIds((prev) => {
      const merged = [...prev];
      for (const id of createdIds) {
        if (!merged.includes(id)) merged.push(id);
      }
      return merged;
    });
  }, []);

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

  return React.useMemo(
    () => ({
      useCaseGeneratorWizard: useCaseGenWizard,
      useCaseBundleFeedback,
      onDismissUseCaseBundleFeedback: () => setUseCaseBundleFeedback(null),
      useCaseHighlightIds,
      onClearUseCaseHighlight: (useCaseId: string) => {
        setUseCaseHighlightIds((prev) => prev.filter((id) => id !== useCaseId));
      },
      onPropagateExamplePhraseStyle: runPropagateExamplePhraseStyle,
      assistantPhraseStyleNewIds,
      onAssistantPhraseDraftChange,
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
      useCasePhraseStylePropagationBusy,
      useCasePhraseStyleBatchProgress,
      onRootUseCaseBatchCreated,
    }),
    [
      useCaseGenWizard,
      useCaseBundleFeedback,
      useCaseHighlightIds,
      assistantPhraseStyleNewIds,
      runPropagateExamplePhraseStyle,
      onAssistantPhraseDraftChange,
      runAssembleConversation,
      conversationActions.assembleConversationBusy,
      runProofreadConversationAgentTurns,
      conversationActions.proofreadConversationBusy,
      runPromoteSuggestionToCatalog,
      runRejectSuggestion,
      runTokenizeUseCases,
      tokenizeUseCasesBusy,
      tokenizedByUseCaseId,
      runClearAllWizardOutput,
      runClearWizardConversations,
      runClearWizardTokenization,
      useCasePhraseStylePropagationBusy,
      useCasePhraseStyleBatchProgress,
      onRootUseCaseBatchCreated,
    ]
  );
}
