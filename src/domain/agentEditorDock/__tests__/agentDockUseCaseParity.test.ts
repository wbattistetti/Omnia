import { describe, expect, it, vi } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { KB_DOCUMENT_KIND_INVALIDATION } from '@domain/knowledgeBase/useCaseInvalidationKb';
import { applyDeleteUseCaseWithInvalidationKb } from '../applyDeleteUseCaseWithInvalidationKb';
import {
  AGENT_DOCK_PROMPTS_PANEL_HANDLER_KEYS,
  agentDockPromptsPanelHandlersComplete,
  agentDockPromptsPanelHandlersFromInvalidation,
} from '../agentDockPromptsPanelHandlers';
import { buildReviewAgentDockValue } from '../../../reviewPortal/buildReviewAgentDockValue';
import { createReviewAgentDockStaticSlice } from '../../../reviewPortal/reviewAgentDockStubs';

function minimalUseCase(id: string): AIAgentUseCase {
  return {
    id,
    label: 'L',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: '',
    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'x' }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('applyDeleteUseCaseWithInvalidationKb', () => {
  it('removes subtree and linked invalidation KB docs', () => {
    const useCases = [minimalUseCase('a'), { ...minimalUseCase('b'), parent_id: 'a' }];
    const kb: StagedKbDocument[] = [
      {
        id: 'kb-1',
        name: 'note',
        size: 1,
        mimeType: 'text/markdown',
        addedAt: '2026-01-01',
        file: new File([], 'n'),
        parseStatus: 'ready',
        variables: [],
        variableDictionary: {},
        howToUseText: '',
        markdownSnippet: 'x',
        documentAnalysisMarkdown: 'x',
        agentAnalysisBaselineMarkdown: 'x',
        kbDocumentKind: KB_DOCUMENT_KIND_INVALIDATION,
        linkedUseCaseId: 'b',
      },
    ];
    const result = applyDeleteUseCaseWithInvalidationKb({
      useCases,
      useCaseId: 'a',
      knowledgeBaseDocuments: kb,
    });
    expect(result?.nextUseCases).toHaveLength(0);
    expect(result?.nextKbDocuments).toHaveLength(0);
    expect(result?.kbChanged).toBe(true);
  });
});

describe('agentDockPromptsPanelHandlers', () => {
  it('maps invalidation handlers to dock keys', () => {
    const onNote = vi.fn();
    const onState = vi.fn();
    const onDelete = vi.fn();
    const mapped = agentDockPromptsPanelHandlersFromInvalidation(
      {
        onUseCaseInvalidationNoteChange: onNote,
        onUseCaseInvalidationStateChange: onState,
        deleteUseCaseWithInvalidationKb: vi.fn(),
      },
      onDelete
    );
    expect(mapped.onUseCaseInvalidationNoteChange).toBe(onNote);
    expect(mapped.onUseCaseInvalidationStateChange).toBe(onState);
    expect(mapped.onDeleteUseCase).toBe(onDelete);
  });

  it('buildReviewAgentDockValue exposes all Prompts panel handler keys', () => {
    const promptsPanelHandlers = agentDockPromptsPanelHandlersFromInvalidation(
      {
        onUseCaseInvalidationNoteChange: vi.fn(),
        onUseCaseInvalidationStateChange: vi.fn(),
        deleteUseCaseWithInvalidationKb: vi.fn(),
      },
      vi.fn()
    );
    const staticSlice = createReviewAgentDockStaticSlice();
    const dock = buildReviewAgentDockValue({
      projectId: 'p1',
      taskInstanceId: 't1',
      designDescription: '',
      setDesignDescription: vi.fn(),
      useCases: [],
      setUseCases: vi.fn(),
      useCaseCategories: [],
      setUseCaseCategories: vi.fn(),
      conversationalRules: [],
      setConversationalRules: vi.fn(),
      structuredRevision: {
        composedRuntimeMarkdown: '',
        sectionsState: staticSlice.structuredSectionsState,
        applyRevisionOps: vi.fn(),
        applyOtCommit: vi.fn(),
        undoSection: vi.fn(),
        redoSection: vi.fn(),
      } as never,
      knowledgeBaseDocuments: [],
      knowledgeBaseAddFiles: vi.fn(),
      knowledgeBaseRemoveDocument: vi.fn(),
      knowledgeBaseUpdateDocument: vi.fn(),
      knowledgeBaseReorderDocuments: vi.fn(),
      backendPlaceholders: [],
      useCaseGlobalStyleId: 'cortese',
      setUseCaseGlobalStyleId: vi.fn(),
      agentUseCaseStyleLearningNotes: '',
      setAgentUseCaseStyleLearningNotes: vi.fn(),
      agentConversationStyleAuto: false,
      setAgentConversationStyleAuto: vi.fn(),
      agentConversationStyleSelections: {},
      setAgentConversationStyleSelections: vi.fn(),
      useCaseCatalogMode: 'prompts',
      useCaseComposerError: null,
      onClearUseCaseComposerError: vi.fn(),
      onComposerIaError: vi.fn(),
      backends: null,
      designerLlm: null,
      ia: {
        buildUseCasePropagatorCallMeta: () => ({}),
      } as never,
      promptsPanelHandlers,
      knowledgeBaseTaskContext: {
        agentTaskSummary: '',
        taskVariables: [],
        existingUseCaseSummaries: [],
      },
      registerBackendsAddManualHandler: vi.fn(),
      invokeBackendsAddManual: vi.fn(),
      hideBackendsPanelInlineAddButton: false,
    });
    expect(agentDockPromptsPanelHandlersComplete(dock)).toBe(true);
    for (const key of AGENT_DOCK_PROMPTS_PANEL_HANDLER_KEYS) {
      expect(typeof dock[key]).toBe('function');
    }
  });
});
