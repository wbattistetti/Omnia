/**
 * Builds {@link AIAgentEditorDockContextValue} for the review portal from review store state.
 */

import type React from 'react';
import type {
  AIAgentEditorDockContextValue,
  UseCaseCatalogMode,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import type { UseStructuredAgentSectionsRevisionResult } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useStructuredAgentSectionsRevision';
import type { AgentReviewConversationSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type { ConversationStyleSelections } from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import type { BackendPlaceholderInstance } from '@domain/agentPrompt';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import {
  createBlankUseCaseInList,
} from '@omnia/domain-core/usecase/logic/useCaseBundleCompose';
import { applySiblingReorderForPersist } from '@omnia/domain-core/usecase/tree/useCaseHierarchy';
import { parseRootUseCaseDraftSegmentsFallback } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/parseRootUseCaseDraft';
import {
  createReviewAgentDockStaticSlice,
  createReviewAgentReviewChannelStub,
  reviewIaDisabledAsync,
  reviewNoop,
} from './reviewAgentDockStubs';
import type { ManualBackendCreationMode } from '@domain/backendCatalog/catalogTypes';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import type { ReviewAgentIaDockSlice } from './useReviewAgentIaDockSlice';
import type { AgentDockPromptsPanelHandlers } from '@domain/agentEditorDock/agentDockPromptsPanelHandlers';
import type { ReviewWizardDockSlice } from './useReviewWizardDockIntegration';
import { areAllUseCasesProjectable } from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';

export interface ReviewAgentDockLiveInput {
  projectId: string;
  taskInstanceId: string;
  designDescription: string;
  setDesignDescription: (value: string) => void;
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  useCaseCategories: readonly AIAgentUseCaseCategory[];
  setUseCaseCategories: React.Dispatch<React.SetStateAction<AIAgentUseCaseCategory[]>>;
  conversationalRules: readonly ConversationalRule[];
  setConversationalRules: React.Dispatch<React.SetStateAction<ConversationalRule[]>>;
  structuredRevision: UseStructuredAgentSectionsRevisionResult;
  knowledgeBaseDocuments: readonly StagedKbDocument[];
  knowledgeBaseAddFiles: (files: readonly File[]) => void;
  knowledgeBaseRemoveDocument: (docId: string) => void;
  knowledgeBaseUpdateDocument: (docId: string, patch: KbDocumentPatch) => void;
  knowledgeBaseReorderDocuments: (next: readonly StagedKbDocument[]) => void;
  backendPlaceholders: readonly BackendPlaceholderInstance[];
  useCaseGlobalStyleId: string;
  setUseCaseGlobalStyleId: (styleId: string) => void;
  agentUseCaseStyleLearningNotes: string;
  setAgentUseCaseStyleLearningNotes: (next: string) => void;
  agentConversationStyleAuto: boolean;
  setAgentConversationStyleAuto: (next: boolean) => void;
  agentConversationStyleSelections: ConversationStyleSelections;
  setAgentConversationStyleSelections: (
    next:
      | ConversationStyleSelections
      | ((prev: ConversationStyleSelections) => ConversationStyleSelections)
  ) => void;
  useCaseCatalogMode: UseCaseCatalogMode;
  useCaseComposerError: string | null;
  onClearUseCaseComposerError: () => void;
  onComposerIaError: (message: string) => void;
  backends: import('@domain/agentReviewChannel/reviewSnapshots').AgentReviewBackendSnapshot | null;
  designerLlm: import('@domain/agentReviewChannel/reviewDocument').AgentReviewDesignerLlmSnapshot | null;
  ia: ReviewAgentIaDockSlice;
  promptsPanelHandlers: AgentDockPromptsPanelHandlers;
  knowledgeBaseTaskContext: KbDocumentAnalysisTaskContext;
  registerBackendsAddManualHandler: (
    handler: ((mode: ManualBackendCreationMode) => void) | null
  ) => void;
  invokeBackendsAddManual: (mode?: ManualBackendCreationMode) => void;
  registerKbAddDocumentPicker: (handler: (() => void) | null) => void;
  invokeKbAddDocumentPicker: () => void;
  hideBackendsPanelInlineAddButton: boolean;
  wizard: ReviewWizardDockSlice;
}

export function conversationalRulesFromReviewSnapshot(
  snapshot: AgentReviewConversationSnapshot | null | undefined
): ConversationalRule[] {
  if (!snapshot?.conversationalRules?.length) return [];
  return snapshot.conversationalRules.map((r) => ({
    id: r.id,
    libraryRuleId: r.libraryRuleId,
    label: r.label,
    scenario: r.scenario,
    exampleMessage: r.exampleMessage,
    sort_order: r.sort_order,
    enabled: r.enabled,
  }));
}

export function conversationStyleSelectionsFromSnapshot(
  snapshot: AgentReviewConversationSnapshot | null | undefined
): ConversationStyleSelections {
  if (!snapshot?.styleSelections) return {};
  const out: ConversationStyleSelections = {};
  for (const [styleId, entry] of Object.entries(snapshot.styleSelections)) {
    out[styleId] = {
      checked: entry.checked,
      description: entry.description,
      example: entry.example,
    };
  }
  return out;
}

export function backendPlaceholdersFromReviewSnapshot(
  snapshot: import('@domain/agentReviewChannel/reviewSnapshots').AgentReviewBackendSnapshot | null | undefined
): BackendPlaceholderInstance[] {
  if (!snapshot?.structuredPlaceholders?.length) return [];
  return snapshot.structuredPlaceholders.map((p) => ({
    id: p.id,
    definitionId: p.definitionId,
  }));
}

/** Assembles the full dock value consumed by Omnia editor panels in the review portal. */
export function buildReviewAgentDockValue(
  live: ReviewAgentDockLiveInput
): AIAgentEditorDockContextValue {
  const staticSlice = createReviewAgentDockStaticSlice();

  const handleCreateUseCase: AIAgentEditorDockContextValue['onCreateUseCase'] = async (params) => {
    live.onClearUseCaseComposerError();
    const label = String(params.label ?? '').trim();
    const parentId = params.parentId ?? null;
    let newId = '';
    live.setUseCases((prev) => {
      const result = createBlankUseCaseInList(prev, {
        parentId,
        label: label || undefined,
      });
      newId = result.newId;
      return result.useCases;
    });
    return newId;
  };

  const handleCreateConversationalRule: AIAgentEditorDockContextValue['onCreateConversationalRule'] =
    async (params) => {
      const label = String(params.label ?? '').trim() || 'Nuova regola';
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `cr-${Date.now()}`;
      live.setConversationalRules((prev) => [
        ...prev,
        {
          id,
          libraryRuleId: null,
          label,
          scenario: '',
          exampleMessage: '',
          sort_order: prev.length,
          enabled: true,
        },
      ]);
      return id;
    };

  return {
    ...staticSlice,
    ...live.ia,
    instanceId: live.taskInstanceId,
    hasAgentGeneration: true,
    designDescription: live.designDescription,
    setDesignDescription: live.setDesignDescription,
    composedRuntimeMarkdown: live.structuredRevision.composedRuntimeMarkdown,
    structuredSectionsState: live.structuredRevision.sectionsState,
    onApplyRevisionOps: live.structuredRevision.applyRevisionOps,
    onApplyOtCommit: live.structuredRevision.applyOtCommit,
    onUndoSection: live.structuredRevision.undoSection,
    onRedoSection: live.structuredRevision.redoSection,
    onDismissIaRevisionForSection: reviewNoop,
    useCaseCatalogMode: live.useCaseCatalogMode,
    useCases: live.useCases,
    setUseCases: live.setUseCases,
    useCaseCategories: live.useCaseCategories,
    setUseCaseCategories: live.setUseCaseCategories,
    conversationalRules: live.conversationalRules,
    setConversationalRules: live.setConversationalRules,
    useCaseComposerError: live.useCaseComposerError,
    onClearUseCaseComposerError: live.onClearUseCaseComposerError,
    onCreateUseCase: handleCreateUseCase,
    onSplitRootUseCaseDraft: async (draftText) => parseRootUseCaseDraftSegmentsFallback(draftText),
    onRootUseCaseBatchCreated: live.wizard.onRootUseCaseBatchCreated,
    onRegenerateAgentMessage: () => reviewIaDisabledAsync('Rigenera messaggio agente'),
    onAnnotateAgentMessageForJson: () => reviewIaDisabledAsync('Annota messaggio JSON'),
    ...live.promptsPanelHandlers,
    onDeleteConversationalRule: (ruleId) => {
      live.setConversationalRules((prev) => prev.filter((r) => r.id !== ruleId));
    },
    useCaseGlobalStyleId: live.useCaseGlobalStyleId,
    setUseCaseGlobalStyleId: live.setUseCaseGlobalStyleId,
    agentUseCaseStyleLearningNotes: live.agentUseCaseStyleLearningNotes,
    setAgentUseCaseStyleLearningNotes: live.setAgentUseCaseStyleLearningNotes,
    setPreviewStyleId: reviewNoop,
    backendPlaceholders: live.backendPlaceholders,
    insertBackendPathAtSection: reviewNoop,
    insertBackendPathInDesign: reviewNoop,
    setAgentPromptTargetPlatform: reviewNoop,
    setAgentImmediateStart: reviewNoop,
    ensurePromptFinalDeterministicCompile: reviewNoop,
    setPromptFinaleJsMode: reviewNoop,
    projectId: live.projectId,
    setIaRuntimeConfig: reviewNoop,
    saveIaRuntimeOverrideToTask: reviewNoop,
    persistIaRuntimeOverrideSnapshot: reviewNoop,
    registerBackendsAddManualHandler: live.registerBackendsAddManualHandler,
    invokeBackendsAddManual: live.invokeBackendsAddManual,
    registerKbAddDocumentPicker: live.registerKbAddDocumentPicker,
    invokeKbAddDocumentPicker: live.invokeKbAddDocumentPicker,
    hideBackendsPanelInlineAddButton: live.hideBackendsPanelInlineAddButton,
    knowledgeBaseCallMeta: live.ia.buildUseCasePropagatorCallMeta('KB_REFINE_DOCUMENT_ANALYSIS'),
    knowledgeBaseTaskContext: live.knowledgeBaseTaskContext,
    setAgentInterfacePanelOpen: reviewNoop,
    setAgentInterfaceInput: reviewNoop as React.Dispatch<React.SetStateAction<never[]>>,
    setAgentInterfaceOutput: reviewNoop as React.Dispatch<React.SetStateAction<never[]>>,
    knowledgeBaseDocuments: live.knowledgeBaseDocuments,
    knowledgeBaseAddFiles: live.knowledgeBaseAddFiles,
    knowledgeBaseRemoveDocument: live.knowledgeBaseRemoveDocument,
    knowledgeBaseUpdateDocument: live.knowledgeBaseUpdateDocument,
    knowledgeBaseReorderDocuments: live.knowledgeBaseReorderDocuments,
    onDismissUseCaseBundleFeedback: live.wizard.onDismissUseCaseBundleFeedback,
    onClearUseCaseHighlight: live.wizard.onClearUseCaseHighlight,
    onPropagateExamplePhraseStyle: live.wizard.onPropagateExamplePhraseStyle,
    onCompleteCorrection: async () => null,
    onAssistantPhraseDraftChange: live.wizard.onAssistantPhraseDraftChange,
    useCasePhraseStylePropagationBusy: live.wizard.useCasePhraseStylePropagationBusy,
    useCasePhraseStyleBatchProgress: live.wizard.useCasePhraseStyleBatchProgress,
    assistantPhraseStyleNewIds: live.wizard.assistantPhraseStyleNewIds,
    useCaseBundleFeedback: live.wizard.useCaseBundleFeedback,
    useCaseHighlightIds: live.wizard.useCaseHighlightIds,
    useCaseGeneratorWizard: live.wizard.useCaseGeneratorWizard,
    setUseCaseSiblingSortMode: reviewNoop,
    reorderUseCaseSiblingByDrag: (draggedId, targetId, position) => {
      live.setUseCases((prev) =>
        applySiblingReorderForPersist(prev, draggedId, targetId, position)
      );
    },
    onAssembleConversation: live.wizard.onAssembleConversation,
    assembleConversationBusy: live.wizard.assembleConversationBusy,
    onProofreadConversationAgentTurns: live.wizard.onProofreadConversationAgentTurns,
    proofreadConversationBusy: live.wizard.proofreadConversationBusy,
    onPromoteSuggestionToCatalog: live.wizard.onPromoteSuggestionToCatalog,
    onRejectSuggestion: live.wizard.onRejectSuggestion,
    onTokenizeUseCases: live.wizard.onTokenizeUseCases,
    tokenizeUseCasesBusy: live.wizard.tokenizeUseCasesBusy,
    tokenizedByUseCaseId: live.wizard.tokenizedByUseCaseId,
    onClearAllWizardOutput: live.wizard.onClearAllWizardOutput,
    onClearWizardConversations: live.wizard.onClearWizardConversations,
    onClearWizardTokenization: live.wizard.onClearWizardTokenization,
    canCreateConversationalPrompt: areAllUseCasesProjectable(live.useCases),
    onOpenConversationalPromptDialog: reviewNoop,
    setAgentConversationStyleExample: reviewNoop,
    agentConversationStyleAuto: live.agentConversationStyleAuto,
    setAgentConversationStyleAuto: live.setAgentConversationStyleAuto,
    agentConversationStyleSelections: live.agentConversationStyleSelections,
    setAgentConversationStyleSelections: live.setAgentConversationStyleSelections,
    setAgentConversationDeployStyleId: reviewNoop,
    setAgentLogUseCase: reviewNoop,
    setAgentBehavior: reviewNoop,
    compileUseCasePhrasesForCatalog: reviewNoop,
    approveLexiconSurface: reviewNoop,
    revokeLexiconSurface: reviewNoop,
    updateLexiconSlotId: reviewNoop,
    agentReviewChannel: createReviewAgentReviewChannelStub(),
    onUpdateProposedField: reviewNoop,
    onRemoveProposedField: reviewNoop,
    appendProposedFields: reviewNoop,
    onProposedLabelBlur: reviewNoop,
    reviewBackendSnapshot: live.backends,
    reviewDesignerLlm: live.designerLlm,
  };
}
