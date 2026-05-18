/**
 * Semantic analyze (manual), guided chat, and rule extraction for the active KB document.
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { KbChatMessage, KbInducedRule } from '@domain/knowledgeBase/kbRuleTypes';
import { createKbChatMessageId } from '@domain/knowledgeBase/kbRuleTypes';
import { useAIProvider } from '@context/AIProviderContext';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import {
  analyzeKbSemantic,
  reanalyzeKbRules,
  chatKbDocument,
  mergeKbRules,
} from '@services/kbSemanticAnalysisApi';
import {
  getLastKbUserMessage,
  hasKbUserChatQuestion,
  KB_ANALYSIS_INTENT_REQUIRED_MSG,
} from '@domain/knowledgeBase/kbChatHelpers';
import {
  KB_DEFAULT_CHAT_OPENER,
  KB_MSG_ANALYZING,
  kbRulesEditedSummary,
  kbRulesFoundSummary,
} from '@domain/knowledgeBase/kbChatCopy';

export type UseKbDocumentActionsParams = {
  doc: StagedKbDocument | null;
  projectId: string | undefined;
  disabled?: boolean;
  callMeta?: AiCallMeta;
  onUpdateDoc: (docId: string, patch: KbDocumentPatch) => void;
};

export function useKbDocumentActions({
  doc,
  projectId,
  disabled = false,
  callMeta,
  onUpdateDoc,
}: UseKbDocumentActionsParams) {
  const { provider, model } = useAIProvider();
  const { hasModel } = useAiBusyLabel();
  const [analyzeBusy, setAnalyzeBusy] = React.useState(false);
  const [chatBusy, setChatBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const rulesEditNotifyRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const repoId = doc?.repositoryDocumentId?.trim();
  const structureJson = React.useMemo(
    () => (doc?.structure ? JSON.stringify(doc.structure, null, 2) : ''),
    [doc?.structure]
  );

  const canAnalyze = Boolean(
    doc && repoId && projectId?.trim() && hasModel && !disabled
  );

  const hasClassification = Boolean(doc && doc.dataTypes.length > 0);
  const hasAnalyzed = Boolean(doc && doc.chatStarted);

  const patchDoc = React.useCallback(
    (patch: KbDocumentPatch) => {
      if (!doc) return;
      onUpdateDoc(doc.id, patch);
    },
    [doc, onUpdateDoc]
  );

  const appendAssistantMessage = React.useCallback(
    (content: string, baseMessages?: readonly KbChatMessage[]) => {
      const msg: KbChatMessage = {
        id: createKbChatMessageId(),
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
      };
      const prev = baseMessages ?? doc?.chatMessages ?? [];
      patchDoc({
        chatMessages: [...prev, msg],
        chatStarted: true,
      });
    },
    [doc?.chatMessages, patchDoc]
  );

  const applyRulePatch = React.useCallback(
    (
      patch: {
        structure?: StagedKbDocument['structure'];
        rules?: KbInducedRule[];
        dataTypes?: string[];
        analysisNote?: string;
      },
      baseRules: readonly KbInducedRule[]
    ) => {
      const next: KbDocumentPatch = {
        semanticStatus: 'ready',
        semanticError: undefined,
      };
      if (patch.structure) next.structure = patch.structure;
      if (patch.dataTypes?.length) next.dataTypes = patch.dataTypes;
      if (patch.analysisNote) next.analysisNote = patch.analysisNote;
      if (patch.rules?.length) {
        next.rules = mergeKbRules(baseRules, patch.rules);
      }
      patchDoc(next);
    },
    [patchDoc]
  );

  const runAnalyze = React.useCallback(async () => {
    if (!canAnalyze || !doc || !repoId) return;
    setAnalyzeBusy(true);
    setActionError(null);
    patchDoc({
      semanticStatus: 'analyzing',
      semanticError: undefined,
      rules: [],
      chatStarted: false,
      chatMessages: [],
    });
    try {
      const result = await analyzeKbSemantic({
        projectId: projectId!,
        repositoryDocumentId: repoId,
        documentName: doc.name,
        variables: doc.variables,
        provider,
        model,
        callMeta,
      });
      const rules = result.rules ?? [];
      const opener =
        result.chatOpener?.trim() ||
        (rules.length > 0
          ? kbRulesFoundSummary(rules)
          : KB_DEFAULT_CHAT_OPENER);
      const assistantMsg: KbChatMessage = {
        id: createKbChatMessageId(),
        role: 'assistant',
        content: opener,
        createdAt: new Date().toISOString(),
      };
      patchDoc({
        structure: result.structure ?? {},
        dataTypes: result.dataTypes,
        rules,
        analysisNote: result.analysisNote,
        semanticStatus: 'ready',
        semanticError: undefined,
        chatStarted: true,
        chatMessages: [assistantMsg],
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setActionError(message);
      patchDoc({ semanticStatus: 'error', semanticError: message });
    } finally {
      setAnalyzeBusy(false);
    }
  }, [canAnalyze, doc, repoId, projectId, provider, model, callMeta, patchDoc]);

  const runReanalyze = React.useCallback(async () => {
    if (!canAnalyze || !doc || !repoId || !doc.chatStarted) return;
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
      createdAt: new Date().toISOString(),
    };
    patchDoc({
      semanticStatus: 'analyzing',
      chatMessages: [...doc.chatMessages, pendingMsg],
    });
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
      });
      const merged = mergeKbRules(doc.rules, result.rules ?? []);
      const summary = kbRulesFoundSummary(merged);
      const withoutPending = doc.chatMessages.filter((m) => m.id !== pendingId);
      const assistantMsg: KbChatMessage = {
        id: createKbChatMessageId(),
        role: 'assistant',
        content: summary,
        createdAt: new Date().toISOString(),
      };
      patchDoc({
        chatMessages: [...withoutPending, assistantMsg],
        rules: merged,
        structure: result.structure ?? doc.structure,
        dataTypes: result.dataTypes?.length ? result.dataTypes : doc.dataTypes,
        analysisNote: result.analysisNote ?? doc.analysisNote,
        semanticStatus: 'ready',
        semanticError: undefined,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setActionError(message);
      patchDoc({
        semanticStatus: 'error',
        semanticError: message,
        chatMessages: doc.chatMessages.filter((m) => m.id !== pendingId),
      });
    } finally {
      setAnalyzeBusy(false);
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
    patchDoc,
  ]);

  const handleChatSend = React.useCallback(
    async (text: string) => {
      if (!canAnalyze || !doc || !repoId) return;
      if (!doc.chatStarted || doc.dataTypes.length === 0) {
        setActionError('Esegui prima Analyze per avviare l\'analisi semantica.');
        return;
      }

      const userMsg: KbChatMessage = {
        id: createKbChatMessageId(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      const analyzingMsg: KbChatMessage = {
        id: createKbChatMessageId(),
        role: 'assistant',
        content: KB_MSG_ANALYZING,
        createdAt: new Date().toISOString(),
      };
      const pendingMessages = [...doc.chatMessages, userMsg, analyzingMsg];
      patchDoc({ chatMessages: pendingMessages, chatStarted: true });
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
        });

        let rules = doc.rules;
        if (result.rulePatch?.rules?.length) {
          rules = mergeKbRules(rules, result.rulePatch.rules);
        }

        const reply =
          result.reply?.trim() ||
          kbRulesFoundSummary(
            result.rulePatch?.rules?.length ? mergeKbRules(doc.rules, result.rulePatch.rules) : rules
          );

        const assistantMsg: KbChatMessage = {
          id: createKbChatMessageId(),
          role: 'assistant',
          content: reply,
          createdAt: new Date().toISOString(),
        };

        const patch: KbDocumentPatch = {
          chatMessages: [...doc.chatMessages, userMsg, assistantMsg],
          chatStarted: true,
          semanticStatus: 'ready',
        };
        if (result.rulePatch?.rules?.length) {
          patch.rules = rules;
          if (result.rulePatch.structure) patch.structure = result.rulePatch.structure;
          if (result.rulePatch.analysisNote) patch.analysisNote = result.rulePatch.analysisNote;
        }
        patchDoc(patch);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : String(e));
        patchDoc({
          chatMessages: [...doc.chatMessages, userMsg],
        });
      } finally {
        setChatBusy(false);
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
      patchDoc,
    ]
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

  React.useEffect(
    () => () => {
      if (rulesEditNotifyRef.current) clearTimeout(rulesEditNotifyRef.current);
    },
    []
  );

  const hasUserChatQuestion = Boolean(
    doc && hasKbUserChatQuestion(doc.chatMessages)
  );

  return {
    canAnalyze,
    hasModel,
    hasClassification,
    hasAnalyzed,
    hasUserChatQuestion,
    analyzeBusy,
    chatBusy,
    actionError,
    runAnalyze,
    runReanalyze,
    handleChatSend,
    notifyRulesEdited,
    setActionError,
  };
}
