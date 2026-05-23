/**
 * Static stubs for {@link AIAgentEditorDockContextValue} fields unused in the review portal.
 */

import type { AIAgentEditorDockContextValue } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import type { PlatformPromptOutput } from '@domain/agentPrompt';
import { emptyProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { AI_AGENT_DEFAULT_PREVIEW_STYLE_ID } from '@types/aiAgentPreview';

const EMPTY_PLATFORM_OUTPUT = {
  platform: 'openai',
  sections: [],
} as unknown as PlatformPromptOutput;

export function reviewIaDisabledSync(action: string): never {
  throw new Error(`${action} non disponibile nel portale review.`);
}

export async function reviewIaDisabledAsync(action: string): Promise<never> {
  throw new Error(`${action} non disponibile nel portale review.`);
}

/** No-op sync handler for optional dock callbacks. */
export function reviewNoop(): void {}

/** Shared IA-disabled review channel stub. */
export function createReviewAgentReviewChannelStub(): AIAgentEditorDockContextValue['agentReviewChannel'] {
  return {
    canUseChannel: false,
    busy: false,
    banner: { kind: 'idle' },
    pendingStatuses: [],
    anyPendingImport: false,
    publishToChannel: async () => {},
    checkAllReviewChannels: async () => [],
    importFromAudience: async () => {},
    reviewPortalUrl: null,
    dismissBanner: reviewNoop,
  };
}

/** Fields that do not depend on review store / structured revision hook. */
export function createReviewAgentDockStaticSlice(): Pick<
  AIAgentEditorDockContextValue,
  | 'structuredDesignDirty'
  | 'structuredOtEnabled'
  | 'iaRevisionDiffBySection'
  | 'generating'
  | 'showRightPanel'
  | 'headerAction'
  | 'primaryAgentActionLabel'
  | 'proposedFields'
  | 'outputVariableMappings'
  | 'logicalSteps'
  | 'useCaseCatalogMode'
  | 'useCasePhraseStylePropagationBusy'
  | 'useCasePhraseStyleBatchProgress'
  | 'useCaseCreationMessage'
  | 'previewStyleId'
  | 'initialStateTemplateJson'
  | 'agentRuntimeCompactJson'
  | 'previewByStyle'
  | 'agentPromptTargetPlatform'
  | 'agentImmediateStart'
  | 'compiledPlatformOutput'
  | 'compiledPromptForTargetPlatform'
  | 'promptFinalAligned'
  | 'promptFinaleJsMode'
  | 'iaRuntimeConfig'
  | 'iaRuntimeLoadedFrom'
  | 'hideBackendsPanelInlineAddButton'
  | 'agentInterfacePanelOpen'
  | 'agentInterfaceInput'
  | 'agentInterfaceOutput'
  | 'agentInterfaceTitle'
  | 'useCaseGeneratorWizard'
  | 'useCaseBundleFeedback'
  | 'useCaseHighlightIds'
  | 'assistantPhraseStyleNewIds'
  | 'useCaseSiblingSortMode'
  | 'assembleConversationBusy'
  | 'proofreadConversationBusy'
  | 'tokenizeUseCasesBusy'
  | 'tokenizedByUseCaseId'
  | 'canCreateConversationalPrompt'
  | 'agentConversationStyleExample'
  | 'agentConversationDeployStyleId'
  | 'agentLogUseCase'
  | 'agentBehavior'
  | 'agentUseCasesJson'
  | 'agentConversationalRulesJson'
  | 'compilePhrasesBusy'
  | 'projectSlotLexicon'
  | 'useCasePropagatorProvider'
  | 'useCasePropagatorModel'
  | 'useCasePropagatorGlobalStyleContract'
  | 'reviewPortalMode'
> {
  return {
    structuredDesignDirty: false,
    structuredOtEnabled: false,
    iaRevisionDiffBySection: null,
    generating: false,
    showRightPanel: true,
    headerAction: null,
    primaryAgentActionLabel: 'Create Agent',
    proposedFields: [],
    outputVariableMappings: {},
    logicalSteps: [],
    useCaseCatalogMode: 'prompts',
    useCasePhraseStylePropagationBusy: false,
    useCasePhraseStyleBatchProgress: null,
    useCaseCreationMessage: null,
    previewStyleId: AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
    initialStateTemplateJson: '{}',
    agentRuntimeCompactJson: '',
    previewByStyle: {},
    agentPromptTargetPlatform: 'openai',
    agentImmediateStart: false,
    compiledPlatformOutput: EMPTY_PLATFORM_OUTPUT,
    compiledPromptForTargetPlatform: '',
    promptFinalAligned: true,
    promptFinaleJsMode: false,
    iaRuntimeConfig: loadGlobalIaAgentConfig(),
    iaRuntimeLoadedFrom: 'global_defaults',
    hideBackendsPanelInlineAddButton: true,
    agentInterfacePanelOpen: false,
    agentInterfaceInput: [],
    agentInterfaceOutput: [],
    agentInterfaceTitle: 'Interface',
    useCaseGeneratorWizard: null,
    useCaseBundleFeedback: null,
    useCaseHighlightIds: [],
    assistantPhraseStyleNewIds: [],
    useCaseSiblingSortMode: 'dialogue',
    assembleConversationBusy: false,
    proofreadConversationBusy: false,
    tokenizeUseCasesBusy: false,
    tokenizedByUseCaseId: {},
    canCreateConversationalPrompt: false,
    agentConversationStyleExample: '',
    agentConversationDeployStyleId: null,
    agentLogUseCase: false,
    agentBehavior: 'A',
    agentUseCasesJson: '[]',
    agentConversationalRulesJson: '[]',
    compilePhrasesBusy: false,
    projectSlotLexicon: emptyProjectSlotLexicon(),
    useCasePropagatorProvider: '',
    useCasePropagatorModel: '',
    useCasePropagatorGlobalStyleContract: '',
    reviewPortalMode: true,
  };
}
