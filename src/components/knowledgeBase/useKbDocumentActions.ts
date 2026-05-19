/**
 * KB semantic analyze, consent flow, rule review, and promotion hooks.
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { KbChatMessage, KbInducedRule, KbRuleStatus } from '@domain/knowledgeBase/kbRuleTypes';
import { createKbChatMessageId } from '@domain/knowledgeBase/kbRuleTypes';
import { useAIProvider } from '@context/AIProviderContext';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import {
  analyzeKbSemantic,
  reanalyzeKbRules,
  chatKbDocument,
  mergeKbRules,
  type KbSemanticTaskContext,
} from '@services/kbSemanticAnalysisApi';
import {
  KB_HYPOTHESIS_INPUT_GUIDE,
  KB_MSG_AI_ANALYZE_DOC,
  KB_MSG_VERIFYING_HYPOTHESIS,
} from '@domain/knowledgeBase/kbChatInteractive';
import type { KbChatInteractiveAction } from './KbChatInteractiveBlock';
import {
  getLastKbUserMessage,
  hasKbUserChatQuestion,
  isKbRetryReply,
  KB_ANALYSIS_INTENT_REQUIRED_MSG,
} from '@domain/knowledgeBase/kbChatHelpers';
import { kbRulesWereEdited } from '@domain/knowledgeBase/kbRuleEdits';
import { isKbRuleStatusPromotable } from '@domain/knowledgeBase/kbRuleStatus';
import {
  KB_DEFAULT_CHAT_OPENER,
  KB_MSG_ANALYZING,
  KB_MSG_ANALYZING_ACK,
  KB_RETRY_REPLY_DEFAULT,
  formatKbAnalyzeErrorForChat,
  kbRulesEditedSummary,
  kbRulesFoundSummary,
} from '@domain/knowledgeBase/kbChatCopy';
import {
  areAllKbRulesResolved,
  confirmAllHighConfidenceRules,
  countOpenRules,
  formatRuleReviewPrompt,
  inferPhaseAfterAnalyze,
  patchRuleStatus,
  pickNextReviewRuleId,
  skipAllOpenKbRules,
} from '@domain/knowledgeBase/kbAnalysisSession';
import type { KbDocumentPatcher } from '@domain/knowledgeBase/useKnowledgeBaseDocuments';
import {
  buildDraftsFromConfirmedRules,
  filterRulesNotYetPromoted,
  mapKbDraftsToAgentUseCases,
} from '@domain/knowledgeBase/kbPromotedUseCaseDraft';
import { kbBundleHasUseCaseId } from '@domain/knowledgeBase/kbUseCaseProvenance';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export type UseKbDocumentActionsParams = {
  doc: StagedKbDocument | null;
  projectId: string | undefined;
  disabled?: boolean;
  callMeta?: AiCallMeta;
  taskContext?: KbSemanticTaskContext;
  onUpdateDoc: (docId: string, patch: KbDocumentPatcher) => void;
  onMergePromotedUseCases?: (useCases: AIAgentUseCase[]) => void;
  existingUseCaseCount?: number;
  existingBundleUseCases?: readonly AIAgentUseCase[];
  /** When set, each skeleton is refined via LLM before merge. */
  regeneratePromotedUseCase?: (skeleton: AIAgentUseCase) => Promise<AIAgentUseCase | null>;
};

export function useKbDocumentActions({
  doc,
  projectId,
  disabled = false,
  callMeta,
  taskContext,
  onUpdateDoc,
  onMergePromotedUseCases,
  existingUseCaseCount = 0,
  existingBundleUseCases = [],
  regeneratePromotedUseCase,
}: UseKbDocumentActionsParams) {
  const { provider, model } = useAIProvider();
  const { hasModel } = useAiBusyLabel();
  const [analyzeBusy, setAnalyzeBusy] = React.useState(false);
  const [promoteBusy, setPromoteBusy] = React.useState(false);
  const [chatBusy, setChatBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [chatDraftSeed, setChatDraftSeed] = React.useState<string | null>(null);
  const [chatFocusSignal, setChatFocusSignal] = React.useState(0);
  const rulesEditNotifyRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rulesEditBaselineRef = React.useRef<readonly KbInducedRule[]>([]);
  const selectedDocIdRef = React.useRef<string | null>(null);

  function clearKbMessageInteractivity(messages: readonly KbChatMessage[]): KbChatMessage[] {
    return messages.map((m) => (m.interactive ? { ...m, interactive: undefined } : m));
  }

  React.useEffect(() => {
    const id = doc?.id ?? null;
    if (selectedDocIdRef.current === id) return;
    selectedDocIdRef.current = id;
    setActionError(null);
    setChatDraftSeed(null);
    setAnalyzeBusy(false);
    setChatBusy(false);
    if (rulesEditNotifyRef.current) {
      clearTimeout(rulesEditNotifyRef.current);
      rulesEditNotifyRef.current = null;
    }
  }, [doc?.id]);

  const repoId = doc?.repositoryDocumentId?.trim();
  const structureJson = React.useMemo(
    () => (doc?.structure ? JSON.stringify(doc.structure, null, 2) : ''),
    [doc?.structure]
  );

  const canAnalyze = Boolean(
    doc && repoId && projectId?.trim() && hasModel && !disabled && doc.parseStatus === 'ready'
  );

  const awaitingHypothesisChoice = Boolean(
    doc && doc.analysisPhase === 'awaiting_hypothesis_choice' && !doc.consentGiven
  );
  const awaitingHypothesisInput = Boolean(
    doc && doc.analysisPhase === 'awaiting_hypothesis_input' && !doc.consentGiven
  );
  const hasClassification = Boolean(doc && doc.dataTypes.length > 0);
  const hasAnalyzed = Boolean(
    doc &&
      (doc.dataTypes.length > 0 ||
        doc.rules.some((r) => !r.deleted) ||
        doc.analysisPhase === 'phase_b' ||
        doc.analysisPhase === 'phase_c' ||
        doc.analysisPhase === 'complete' ||
        (doc.chatStarted && doc.consentGiven))
  );

  const patchDoc = React.useCallback(
    (patch: KbDocumentPatcher, docId?: string) => {
      const id = docId ?? doc?.id;
      if (!id) return;
      onUpdateDoc(id, patch);
    },
    [doc?.id, onUpdateDoc]
  );

  const patchAnalyzeFailure = React.useCallback(
    (prev: StagedKbDocument, pendingId: string, rawError: string): KbDocumentPatch => {
      const errorMsg: KbChatMessage = {
        id: createKbChatMessageId(),
        role: 'assistant',
        content: formatKbAnalyzeErrorForChat(rawError),
        tone: 'error',
        createdAt: new Date().toISOString(),
      };
      return {
        semanticStatus: 'error',
        semanticError: undefined,
        chatStarted: true,
        analysisPhase: prev.consentGiven ? 'phase_a' : 'awaiting_hypothesis_choice',
        chatMessages: [
          ...prev.chatMessages.filter((m) => m.id !== pendingId),
          errorMsg,
        ],
      };
    },
    []
  );

  const appendAssistantMessage = React.useCallback(
    (content: string, docId?: string) => {
      const msg: KbChatMessage = {
        id: createKbChatMessageId(),
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
      };
      patchDoc(
        (prev) => ({
          chatMessages: [...prev.chatMessages, msg],
          chatStarted: true,
        }),
        docId ?? doc?.id
      );
    },
    [doc?.id, patchDoc]
  );

  const advanceAfterRuleChange = React.useCallback(
    (rules: readonly KbInducedRule[], currentRuleId: string | null) => {
      const nextId = pickNextReviewRuleId(rules, currentRuleId);
      const phase = areAllKbRulesResolved(rules)
        ? rules.some((r) => isKbRuleStatusPromotable(r.status))
          ? 'phase_c'
          : 'phase_b'
        : 'phase_b';
      return { currentRuleId: nextId, analysisPhase: phase as StagedKbDocument['analysisPhase'] };
    },
    []
  );

  const runAnalyze = React.useCallback(async (opts?: { analysisIntent?: string }) => {
    if (!canAnalyze || !doc || !repoId) return;
    const targetId = doc.id;
    const analysisIntent = opts?.analysisIntent?.trim();
    const pendingId = createKbChatMessageId();
    const pendingMsg: KbChatMessage = {
      id: pendingId,
      role: 'assistant',
      content: KB_MSG_ANALYZING_ACK,
      tone: 'working',
      createdAt: new Date().toISOString(),
    };
    setAnalyzeBusy(true);
    setActionError(null);
    patchDoc(
      (prev) => ({
        semanticStatus: 'analyzing',
        semanticError: undefined,
        analysisPhase: 'phase_a',
        consentGiven: true,
        chatStarted: true,
        chatMessages: [...prev.chatMessages, pendingMsg],
      }),
      targetId
    );
    try {
      const result = await analyzeKbSemantic({
        projectId: projectId!,
        repositoryDocumentId: repoId,
        documentName: doc.name,
        variables: doc.variables,
        provider,
        model,
        callMeta,
        taskContext,
        analysisIntent,
      });
      const rules = result.rules ?? [];
      const firstId = pickNextReviewRuleId(rules, null);
      const opener =
        result.chatOpener?.trim() ||
        (rules.length > 0 ? kbRulesFoundSummary(rules) : KB_DEFAULT_CHAT_OPENER);
      const assistantMsg: KbChatMessage = {
        id: createKbChatMessageId(),
        role: 'assistant',
        content: opener,
        createdAt: new Date().toISOString(),
      };
      const noRules = rules.length === 0;
      patchDoc(
        (prev) => {
          const withoutPending = prev.chatMessages.filter((m) => m.id !== pendingId);
          return {
            structure: result.structure ?? {},
            dataTypes: result.dataTypes,
            rules,
            analysisNote: result.analysisNote,
            semanticStatus: 'ready',
            semanticError: undefined,
            chatStarted: true,
            chatMessages: [...withoutPending, assistantMsg],
            analysisPhase: inferPhaseAfterAnalyze(rules),
            currentRuleId: firstId,
            noActionableRules: noRules,
          };
        },
        targetId
      );
      if (selectedDocIdRef.current === targetId) {
        setChatDraftSeed(null);
        rulesEditBaselineRef.current = rules;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (selectedDocIdRef.current === targetId) {
        setActionError(null);
        setChatDraftSeed(KB_RETRY_REPLY_DEFAULT);
      }
      patchDoc((prev) => patchAnalyzeFailure(prev, pendingId, message), targetId);
    } finally {
      if (selectedDocIdRef.current === targetId) setAnalyzeBusy(false);
    }
  }, [
    canAnalyze,
    doc,
    repoId,
    projectId,
    provider,
    model,
    callMeta,
    taskContext,
    patchDoc,
    patchAnalyzeFailure,
  ]);

  const beginAnalyzeFromChoice = React.useCallback(
    async (opts?: { userHypothesis?: string }) => {
      if (!doc || !canAnalyze) return;
      const targetId = doc.id;
      const hypothesis = opts?.userHypothesis?.trim();
      patchDoc((prev) => {
        const cleared = clearKbMessageInteractivity(prev.chatMessages);
        const messages = [...cleared];
        if (hypothesis) {
          messages.push({
            id: createKbChatMessageId(),
            role: 'user',
            content: hypothesis,
            createdAt: new Date().toISOString(),
          });
        }
        messages.push({
          id: createKbChatMessageId(),
          role: 'assistant',
          content: hypothesis ? KB_MSG_VERIFYING_HYPOTHESIS : KB_MSG_AI_ANALYZE_DOC,
          tone: 'working',
          createdAt: new Date().toISOString(),
        });
        return {
          consentGiven: true,
          chatStarted: true,
          chatMessages: messages,
        };
      }, targetId);
      await runAnalyze(
        hypothesis
          ? {
              analysisIntent: `Verifica le ipotesi del designer sul documento:\n${hypothesis}`,
            }
          : undefined
      );
    },
    [doc, canAnalyze, patchDoc, runAnalyze]
  );

  const handleInteractiveAction = React.useCallback(
    (action: KbChatInteractiveAction) => {
      if (!doc || !awaitingHypothesisChoice || analyzeBusy) return;
      if (action.type === 'hypothesis_yes') {
        patchDoc((prev) => ({
          analysisPhase: 'awaiting_hypothesis_input',
          chatMessages: [
            ...clearKbMessageInteractivity(prev.chatMessages),
            {
              id: createKbChatMessageId(),
              role: 'assistant',
              content: KB_HYPOTHESIS_INPUT_GUIDE,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
        setChatFocusSignal((n) => n + 1);
        return;
      }
      if (action.type === 'hypothesis_no') {
        void beginAnalyzeFromChoice();
      }
    },
    [doc, awaitingHypothesisChoice, analyzeBusy, patchDoc, beginAnalyzeFromChoice]
  );

  const notifyRulesEdited = React.useCallback(() => {
    if (!doc?.chatStarted) return;
    if (rulesEditNotifyRef.current) clearTimeout(rulesEditNotifyRef.current);
    rulesEditNotifyRef.current = setTimeout(() => {
      rulesEditNotifyRef.current = null;
      const last = doc.chatMessages[doc.chatMessages.length - 1];
      const summary = kbRulesEditedSummary();
      if (last?.role === 'assistant' && last.content === summary) return;
      appendAssistantMessage(summary);
    }, 600);
  }, [doc, appendAssistantMessage]);

  const patchRule = React.useCallback(
    (ruleId: string, patch: Partial<KbInducedRule>) => {
      if (!doc) return;
      const before = doc.rules;
      const rules = before.map((r) => (r.id === ruleId ? { ...r, ...patch } : r));
      patchDoc({ rules });
      if (kbRulesWereEdited(before, rules)) {
        notifyRulesEdited();
      }
    },
    [doc, patchDoc, notifyRulesEdited]
  );

  const setRuleStatus = React.useCallback(
    (ruleId: string, status: KbRuleStatus) => {
      if (!doc) return;
      const rules = patchRuleStatus(doc.rules, ruleId, status);
      const adv = advanceAfterRuleChange(rules, ruleId);
      patchDoc({ rules, ...adv });
      const rule = rules.find((r) => r.id === ruleId);
      if (rule && adv.currentRuleId && adv.currentRuleId !== ruleId) {
        const next = rules.find((r) => r.id === adv.currentRuleId);
        if (next) appendAssistantMessage(formatRuleReviewPrompt(next));
      } else if (areAllKbRulesResolved(rules)) {
        appendAssistantMessage(
          rules.some((r) => isKbRuleStatusPromotable(r.status))
            ? 'Review completata. Puoi promuovere le regole validate in use case.'
            : 'Tutte le regole sono chiuse. Nessuna validata — puoi segnare il documento come senza use case.'
        );
      }
    },
    [doc, patchDoc, advanceAfterRuleChange, appendAssistantMessage]
  );

  const confirmAllHighConfidence = React.useCallback(() => {
    if (!doc) return;
    const rules = confirmAllHighConfidenceRules(doc.rules);
    const adv = advanceAfterRuleChange(rules, doc.currentRuleId);
    patchDoc({ rules, ...adv });
    appendAssistantMessage('Ho validato tutte le regole ad alta confidenza. Controlla le card e promuovi se ok.');
  }, [doc, patchDoc, advanceAfterRuleChange, appendAssistantMessage]);

  const focusRule = React.useCallback(
    (ruleId: string) => {
      if (!doc) return;
      const rule = doc.rules.find((r) => r.id === ruleId);
      patchDoc({ currentRuleId: ruleId });
      if (rule) appendAssistantMessage(formatRuleReviewPrompt(rule));
    },
    [doc, patchDoc, appendAssistantMessage]
  );

  const promoteConfirmedRules = React.useCallback(async () => {
    if (!doc || promoteBusy) return;
    const eligible = filterRulesNotYetPromoted(doc.rules, doc.promotedDrafts);
    if (eligible.length === 0) {
      setActionError('Nessuna regola confermata nuova da promuovere.');
      return;
    }
    setActionError(null);
    setPromoteBusy(true);
    const drafts = buildDraftsFromConfirmedRules(eligible, doc.id);
    let skeletons = mapKbDraftsToAgentUseCases(
      drafts,
      existingUseCaseCount,
      doc.name
    ).filter((uc) => !kbBundleHasUseCaseId(existingBundleUseCases, uc.id));

    if (skeletons.length === 0) {
      setPromoteBusy(false);
      setActionError('Gli use case da queste regole sono già nel bundle.');
      return;
    }

    let promotionStatus: StagedKbDocument['promotionStatus'] = 'ok';
    if (regeneratePromotedUseCase) {
      const refined: AIAgentUseCase[] = [];
      let failed = 0;
      for (const sk of skeletons) {
        try {
          const next = await regeneratePromotedUseCase(sk);
          if (next) refined.push(next);
          else failed += 1;
        } catch {
          failed += 1;
          refined.push(sk);
        }
      }
      skeletons = refined;
      promotionStatus = failed > 0 ? (refined.length > 0 ? 'partial' : 'failed') : 'ok';
    }

    patchDoc({
      promotedDrafts: [...doc.promotedDrafts, ...drafts],
      promotionStatus,
      analysisPhase: 'phase_c',
    });
    onMergePromotedUseCases?.(skeletons);
    appendAssistantMessage(
      promotionStatus === 'failed'
        ? 'Promozione non riuscita; riprova o modifica le regole.'
        : `Ho aggiunto ${skeletons.length} use case al bundle${promotionStatus === 'partial' ? ' (alcune rigenerazioni IA fallite, controlla il testo)' : ''}.`
    );
    setPromoteBusy(false);
  }, [
    doc,
    promoteBusy,
    patchDoc,
    onMergePromotedUseCases,
    existingUseCaseCount,
    existingBundleUseCases,
    regeneratePromotedUseCase,
    appendAssistantMessage,
  ]);

  const signOffNoUseCases = React.useCallback(() => {
    if (!doc) return;
    const rules = skipAllOpenKbRules(doc.rules);
    patchDoc({
      rules,
      designerSignOffNoUseCases: true,
      noActionableRules: true,
      analysisPhase: 'complete',
    });
    appendAssistantMessage('Documento segnato come analizzato senza use case da questo file.');
  }, [doc, patchDoc, appendAssistantMessage]);

  const runReanalyze = React.useCallback(async () => {
    if (!canAnalyze || !doc || !repoId || !doc.chatStarted) return;
    const targetId = doc.id;
    const analysisIntent = getLastKbUserMessage(doc.chatMessages);
    if (!analysisIntent) {
      setActionError(KB_ANALYSIS_INTENT_REQUIRED_MSG);
      return;
    }
    setAnalyzeBusy(true);
    setActionError(null);
    const pendingId = createKbChatMessageId();
    const pendingMsg: KbChatMessage = {
      id: pendingId,
      role: 'assistant',
      content: KB_MSG_ANALYZING,
      tone: 'working',
      createdAt: new Date().toISOString(),
    };
    patchDoc(
      (prev) => ({
        semanticStatus: 'analyzing',
        chatMessages: [...prev.chatMessages, pendingMsg],
      }),
      targetId
    );
    try {
      const result = await reanalyzeKbRules({
        projectId: projectId!,
        repositoryDocumentId: repoId,
        documentName: doc.name,
        variables: doc.variables,
        structureJson,
        dataTypes: doc.dataTypes,
        rules: doc.rules,
        analysisIntent,
        provider,
        model,
        callMeta,
        taskContext,
      });
      patchDoc((prev) => {
        const merged = mergeKbRules(prev.rules, result.rules ?? []);
        const summary = kbRulesFoundSummary(merged);
        const withoutPending = prev.chatMessages.filter((m) => m.id !== pendingId);
        const assistantMsg: KbChatMessage = {
          id: createKbChatMessageId(),
          role: 'assistant',
          content: summary,
          createdAt: new Date().toISOString(),
        };
        const nextId = pickNextReviewRuleId(merged, prev.currentRuleId);
        return {
          chatMessages: [...withoutPending, assistantMsg],
          rules: merged,
          structure: result.structure ?? prev.structure,
          dataTypes: result.dataTypes?.length ? result.dataTypes : prev.dataTypes,
          analysisNote: result.analysisNote ?? prev.analysisNote,
          semanticStatus: 'ready',
          semanticError: undefined,
          currentRuleId: nextId,
          analysisPhase: inferPhaseAfterAnalyze(merged),
        };
      }, targetId);
      if (selectedDocIdRef.current === targetId) setChatDraftSeed(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (selectedDocIdRef.current === targetId) {
        setActionError(null);
        setChatDraftSeed(KB_RETRY_REPLY_DEFAULT);
      }
      patchDoc((prev) => patchAnalyzeFailure(prev, pendingId, message), targetId);
    } finally {
      if (selectedDocIdRef.current === targetId) setAnalyzeBusy(false);
    }
  }, [
    canAnalyze,
    doc,
    repoId,
    projectId,
    structureJson,
    provider,
    model,
    callMeta,
    taskContext,
    patchDoc,
    patchAnalyzeFailure,
  ]);

  const handleChatSend = React.useCallback(
    async (text: string) => {
      if (!canAnalyze || !doc || !repoId) return;
      const targetId = doc.id;
      if (awaitingHypothesisChoice) {
        setActionError('Usa i pulsanti Sì o No nel messaggio sopra per iniziare.');
        return;
      }
      if (awaitingHypothesisInput) {
        const trimmed = text.trim();
        if (!trimmed) return;
        setActionError(null);
        setChatDraftSeed(null);
        await beginAnalyzeFromChoice({ userHypothesis: trimmed });
        return;
      }
      const trimmed = text.trim();
      if (isKbRetryReply(trimmed) && doc.semanticStatus === 'error') {
        const userMsg: KbChatMessage = {
          id: createKbChatMessageId(),
          role: 'user',
          content: trimmed,
          createdAt: new Date().toISOString(),
        };
        patchDoc(
          (prev) => ({
            chatMessages: [...prev.chatMessages, userMsg],
            chatStarted: true,
          }),
          targetId
        );
        setChatDraftSeed(null);
        setActionError(null);
        await runAnalyze();
        return;
      }
      if (!doc.chatStarted || doc.dataTypes.length === 0) {
        if (!awaitingHypothesisChoice && doc.analysisPhase !== 'awaiting_hypothesis_choice') {
          setActionError('Attendi la scelta iniziale in chat (Sì / No) per avviare l\'analisi.');
        }
        return;
      }

      const userMsg: KbChatMessage = {
        id: createKbChatMessageId(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      const pendingId = createKbChatMessageId();
      const analyzingMsg: KbChatMessage = {
        id: pendingId,
        role: 'assistant',
        content: KB_MSG_ANALYZING_ACK,
        tone: 'working',
        createdAt: new Date().toISOString(),
      };
      patchDoc(
        (prev) => ({
          chatMessages: [...prev.chatMessages, userMsg, analyzingMsg],
          chatStarted: true,
        }),
        targetId
      );
      setChatBusy(true);
      setActionError(null);

      try {
        const result = await chatKbDocument({
          projectId: projectId!,
          repositoryDocumentId: repoId,
          documentName: doc.name,
          variables: doc.variables,
          structureJson,
          dataTypes: doc.dataTypes,
          rules: doc.rules,
          messages: [...doc.chatMessages, userMsg],
          userMessage: text,
          provider,
          model,
          callMeta,
          taskContext: {
            ...taskContext,
            currentRuleId: doc.currentRuleId,
          },
        });

        patchDoc((prev) => {
          let rules = prev.rules;
          if (result.rulePatch?.rules?.length) {
            rules = mergeKbRules(rules, result.rulePatch.rules);
          }
          const reply =
            result.reply?.trim() ||
            kbRulesFoundSummary(
              result.rulePatch?.rules?.length
                ? mergeKbRules(prev.rules, result.rulePatch.rules)
                : rules
            );
          const assistantMsg: KbChatMessage = {
            id: createKbChatMessageId(),
            role: 'assistant',
            content: reply,
            createdAt: new Date().toISOString(),
          };
          const withoutPending = prev.chatMessages.filter((m) => m.id !== pendingId);
          const adv = advanceAfterRuleChange(rules, prev.currentRuleId);
          const patch: KbDocumentPatch = {
            chatMessages: [...withoutPending, assistantMsg],
            chatStarted: true,
            semanticStatus: 'ready',
            rules,
            ...adv,
          };
          if (result.rulePatch?.structure) patch.structure = result.rulePatch.structure;
          if (result.rulePatch?.analysisNote) patch.analysisNote = result.rulePatch.analysisNote;
          return patch;
        }, targetId);
        if (selectedDocIdRef.current === targetId) setChatDraftSeed(null);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (selectedDocIdRef.current === targetId) {
          setActionError(null);
          setChatDraftSeed(KB_RETRY_REPLY_DEFAULT);
        }
        patchDoc((prev) => patchAnalyzeFailure(prev, pendingId, message), targetId);
      } finally {
        if (selectedDocIdRef.current === targetId) setChatBusy(false);
      }
    },
    [
      canAnalyze,
      doc,
      repoId,
      projectId,
      structureJson,
      provider,
      model,
      callMeta,
      taskContext,
      patchDoc,
      patchAnalyzeFailure,
      awaitingHypothesisChoice,
      awaitingHypothesisInput,
      beginAnalyzeFromChoice,
      advanceAfterRuleChange,
      runAnalyze,
    ]
  );

  React.useEffect(
    () => () => {
      if (rulesEditNotifyRef.current) clearTimeout(rulesEditNotifyRef.current);
    },
    []
  );

  const hasUserChatQuestion = Boolean(
    doc && hasKbUserChatQuestion(doc.chatMessages)
  );

  const openRuleCount = doc ? countOpenRules(doc.rules) : 0;

  return {
    canAnalyze,
    hasModel,
    hasClassification,
    hasAnalyzed,
    awaitingHypothesisChoice,
    awaitingHypothesisInput,
    hasUserChatQuestion,
    analyzeBusy,
    promoteBusy,
    chatBusy,
    actionError,
    chatDraftSeed,
    chatFocusSignal,
    openRuleCount,
    runAnalyze,
    runReanalyze,
    handleChatSend,
    handleInteractiveAction,
    notifyRulesEdited,
    patchRule,
    setRuleStatus,
    confirmAllHighConfidence,
    focusRule,
    promoteConfirmedRules,
    signOffNoUseCases,
    setActionError,
  };
}
