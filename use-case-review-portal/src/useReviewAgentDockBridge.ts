/**
 * Hook: review store + structured sections revision → Omnia {@link AIAgentEditorDockContextValue}.
 */

import React from 'react';
import type { UseCaseCatalogMode } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import type { AIAgentEditorDockContextValue } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import { persistedSectionsFromReviewImport } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/structuredSectionsFromReviewImport';
import { useStructuredAgentSectionsRevision } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useStructuredAgentSectionsRevision';
import { AGENT_STRUCTURED_SECTION_IDS } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/agentStructuredSectionIds';
import type { AgentReviewStructuredSections } from '@domain/agentReviewChannel/reviewDocument';
import type { ReviewPortalStepId } from '@omnia/domain-components';
import {
  backendPlaceholdersFromReviewSnapshot,
  buildReviewAgentDockValue,
  conversationStyleSelectionsFromSnapshot,
  conversationalRulesFromReviewSnapshot,
} from '@reviewPortal/buildReviewAgentDockValue';
import { useReviewKnowledgeBaseDocuments } from '@reviewPortal/useReviewKnowledgeBaseDocuments';
import { useReviewAgentIaDockSlice } from '@reviewPortal/useReviewAgentIaDockSlice';
import { useReviewStore } from './reviewStore';

function structuredSectionsEqual(
  a: AgentReviewStructuredSections,
  b: AgentReviewStructuredSections
): boolean {
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    if ((a[id] ?? '') !== (b[id] ?? '')) return false;
  }
  return true;
}

export interface UseReviewAgentDockBridgeParams {
  activeStep: ReviewPortalStepId;
  composerError: string | null;
  setComposerError: (message: string | null) => void;
}

export function useReviewAgentDockBridge({
  activeStep,
  composerError,
  setComposerError,
}: UseReviewAgentDockBridgeParams): AIAgentEditorDockContextValue {
  const session = useReviewStore((s) => s.session)!;
  const description = useReviewStore((s) => s.description);
  const setDescription = useReviewStore((s) => s.setDescription);
  const structuredSections = useReviewStore((s) => s.structuredSections);
  const replaceStructuredSections = useReviewStore((s) => s.replaceStructuredSections);
  const knowledgeBase = useReviewStore((s) => s.knowledgeBase);
  const setKnowledgeBase = useReviewStore((s) => s.setKnowledgeBase);
  const backends = useReviewStore((s) => s.backends);
  const designerLlm = useReviewStore((s) => s.designerLlm);
  const conversation = useReviewStore((s) => s.conversation);
  const patchConversation = useReviewStore((s) => s.patchConversation);
  const useCases = useReviewStore((s) => s.useCases);
  const setUseCases = useReviewStore((s) => s.setUseCases);
  const categories = useReviewStore((s) => s.categories);
  const setCategories = useReviewStore((s) => s.setCategories);
  const channelLoaded = useReviewStore((s) => s.channelLoaded);

  const structuredRevision = useStructuredAgentSectionsRevision(false);
  const loadedTaskRef = React.useRef<string | null>(null);
  const loadedConvRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!channelLoaded) {
      loadedTaskRef.current = null;
      loadedConvRef.current = null;
    }
  }, [channelLoaded]);

  React.useEffect(() => {
    if (!channelLoaded) return;
    const key = `${session.projectId}:${session.taskId}`;
    if (loadedTaskRef.current === key) return;
    loadedTaskRef.current = key;
    const sections = useReviewStore.getState().structuredSections;
    structuredRevision.loadFromPersisted(persistedSectionsFromReviewImport(sections));
  }, [channelLoaded, session.projectId, session.taskId, structuredRevision]);

  React.useEffect(() => {
    if (!channelLoaded) return;
    const next: AgentReviewStructuredSections = {};
    for (const id of AGENT_STRUCTURED_SECTION_IDS) {
      next[id] = structuredRevision.effectiveBySection[id] ?? '';
    }
    if (!structuredSectionsEqual(structuredSections, next)) {
      replaceStructuredSections(next);
    }
  }, [
    channelLoaded,
    structuredRevision.effectiveBySection,
    structuredSections,
    replaceStructuredSections,
  ]);

  const [conversationalRules, setConversationalRules] = React.useState(() =>
    conversationalRulesFromReviewSnapshot(conversation)
  );
  const [styleSelections, setStyleSelections] = React.useState(() =>
    conversationStyleSelectionsFromSnapshot(conversation)
  );
  const [styleAuto, setStyleAuto] = React.useState(() => conversation?.styleAuto ?? false);
  const [globalStyleId, setGlobalStyleId] = React.useState(
    () => conversation?.globalStyleId ?? 'cortese'
  );
  const [styleLearningNotes, setStyleLearningNotes] = React.useState(
    () => conversation?.styleLearningNotes ?? ''
  );

  React.useEffect(() => {
    if (!channelLoaded) return;
    const key = `${session.projectId}:${session.taskId}`;
    if (loadedConvRef.current === key) return;
    loadedConvRef.current = key;
    const snap = useReviewStore.getState().conversation;
    setConversationalRules(conversationalRulesFromReviewSnapshot(snap));
    setStyleSelections(conversationStyleSelectionsFromSnapshot(snap));
    setStyleAuto(snap?.styleAuto ?? false);
    setGlobalStyleId(snap?.globalStyleId ?? 'cortese');
    setStyleLearningNotes(snap?.styleLearningNotes ?? '');
  }, [channelLoaded, session.projectId, session.taskId]);

  React.useEffect(() => {
    if (!channelLoaded) return;
    patchConversation({
      conversationalRules: conversationalRules.map((r) => ({
        id: r.id,
        libraryRuleId: r.libraryRuleId,
        label: r.label,
        scenario: r.scenario,
        exampleMessage: r.exampleMessage,
        sort_order: r.sort_order,
        enabled: r.enabled,
      })),
      styleAuto,
      styleSelections: Object.fromEntries(
        Object.entries(styleSelections).map(([styleId, entry]) => [
          styleId,
          {
            checked: entry.checked,
            description: entry.description,
            example: entry.example,
          },
        ])
      ),
      globalStyleId,
      styleLearningNotes,
      deployStyleId: conversation?.deployStyleId ?? null,
    });
  }, [
    channelLoaded,
    conversationalRules,
    styleAuto,
    styleSelections,
    globalStyleId,
    styleLearningNotes,
    patchConversation,
    conversation?.deployStyleId,
  ]);

  const useCaseCatalogMode: UseCaseCatalogMode =
    activeStep === 'conversation' ? 'error_handling' : 'prompts';

  const sessionKey = `${session.projectId}:${session.taskId}`;

  const kb = useReviewKnowledgeBaseDocuments({
    projectId: session.projectId,
    channelLoaded,
    sessionKey,
    knowledgeBaseSnapshot: knowledgeBase,
    setKnowledgeBaseSnapshot: setKnowledgeBase,
  });

  const backendPlaceholders = React.useMemo(
    () => backendPlaceholdersFromReviewSnapshot(backends),
    [backends]
  );

  const ia = useReviewAgentIaDockSlice({
    projectId: session.projectId,
    taskInstanceId: session.taskId,
    taskLabel: session.taskLabel,
    designDescription: description,
    setDesignDescription: setDescription,
    useCases,
    setUseCases,
    structuredRevision,
    knowledgeBaseDocuments: kb.documents,
    useCaseGlobalStyleId: globalStyleId,
    agentUseCaseStyleLearningNotes: styleLearningNotes,
    channelLoaded,
    useCaseComposerError: composerError,
    onClearUseCaseComposerError: () => setComposerError(null),
    onComposerIaError: setComposerError,
  });

  return React.useMemo(
    () =>
      buildReviewAgentDockValue({
        projectId: session.projectId,
        taskInstanceId: session.taskId,
        designDescription: description,
        setDesignDescription: setDescription,
        useCases,
        setUseCases,
        useCaseCategories: categories,
        setUseCaseCategories: setCategories,
        conversationalRules,
        setConversationalRules,
        structuredRevision,
        knowledgeBaseDocuments: kb.documents,
        knowledgeBaseAddFiles: kb.addFiles,
        knowledgeBaseRemoveDocument: kb.removeDocument,
        knowledgeBaseUpdateDocument: kb.updateDocument,
        knowledgeBaseReorderDocuments: kb.reorderDocuments,
        backendPlaceholders,
        useCaseGlobalStyleId: globalStyleId,
        setUseCaseGlobalStyleId: setGlobalStyleId,
        agentUseCaseStyleLearningNotes: styleLearningNotes,
        setAgentUseCaseStyleLearningNotes: setStyleLearningNotes,
        agentConversationStyleAuto: styleAuto,
        setAgentConversationStyleAuto: setStyleAuto,
        agentConversationStyleSelections: styleSelections,
        setAgentConversationStyleSelections: setStyleSelections,
        useCaseCatalogMode,
        useCaseComposerError: composerError,
        onClearUseCaseComposerError: () => setComposerError(null),
        onComposerIaError: setComposerError,
        backends,
        designerLlm,
        ia,
      }),
    [
      session.projectId,
      session.taskId,
      description,
      setDescription,
      useCases,
      setUseCases,
      categories,
      setCategories,
      conversationalRules,
      structuredRevision,
      kb.documents,
      kb.addFiles,
      kb.removeDocument,
      kb.updateDocument,
      kb.reorderDocuments,
      backendPlaceholders,
      globalStyleId,
      styleLearningNotes,
      styleAuto,
      styleSelections,
      useCaseCatalogMode,
      composerError,
      setComposerError,
      backends,
      designerLlm,
      ia,
    ]
  );
}
