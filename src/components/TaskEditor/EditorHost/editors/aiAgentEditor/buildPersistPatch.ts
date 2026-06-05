/**
 * Maps in-memory AI Agent editor state to the flat Task patch for TaskRepository.
 */

import { previewTurnsToLegacySample } from '@types/aiAgentPreview';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type {
  AgentConstructionPhase,
  AgentWizardStepIndex,
} from '@domain/aiAgentConstruction/agentConstructionPhase';
import type { ConversationStyleSelections } from '@domain/aiAgentConversationStyle/conversationStyleSelections';

export interface AIAgentPersistState {
  designDescription: string;
  agentPrompt: string;
  agentPromptTargetPlatform: string;
  /** Serialized `PersistedStructuredSections`. */
  agentStructuredSectionsJson: string;
  outputVariableMappings: Record<string, string>;
  proposedFields: AIAgentProposedVariable[];
  previewByStyle: Record<string, AIAgentPreviewTurn[]>;
  previewStyleId: string;
  initialStateTemplateJson: string;
  /** JSON string: design-time compact runtime (`runtime_compact` from generate API). */
  agentRuntimeCompactJson: string;
  agentUseCaseGlobalStyleId: string;
  /** Note designer unite al preset stile per le chiamate LLM use case. */
  agentUseCaseStyleLearningNotes: string;
  hasAgentGeneration: boolean;
  agentLogicalStepsJson: string;
  agentUseCasesJson: string;
  agentStartPromptJson: string;
  agentStartUseCaseId: string;
  agentConversationalRulesJson: string;
  /** JSON wizard pipeline + baseline (use case guided generator). */
  agentUseCaseWizardStateJson: string;
  agentIaRuntimeOverrideJson: string;
  agentImmediateStart: boolean;
  /** Phase machine top-level del Task Editor AI Agent (vedi `agentConstructionPhase` su Task). */
  agentConstructionPhase: AgentConstructionPhase;
  /** Indice (0-based) dello step corrente del wizard di costruzione (0..4). */
  agentWizardCurrentStep: AgentWizardStepIndex;
  /** True dopo il primo click «Cominciamo» nella schermata Tutor del wizard. */
  agentWizardTutorAcknowledged: boolean;
  /** **DEPRECATED** v1: ancora scritto a `''` per non rompere chi legge legacy; v2 usa selections. */
  agentConversationStyleExample: string;
  /** Checkbox **GLOBALE** «Lascia che Omnia scelga uno stile» — gate v2 multi-stile. */
  agentConversationStyleAuto: boolean;
  /** v2 multi-stile: mappa `styleId → { checked, description, example }`. */
  agentConversationStyleSelections: ConversationStyleSelections;
  /** Stile target di Upload (single per ora). */
  agentConversationDeployStyleId: string | null;
  /** Toggle "Logga Use Case" della dropdown Upload. Default `false`. */
  agentLogUseCase: boolean;
  agentLogBackendCalls: boolean;
  agentBehavior: 'A' | 'B' | 'C';
  agentInterfaceJson: string;
  /** JSON array of {@link import('@domain/knowledgeBase/kbDocumentTypes').PersistedKbDocument}. */
  agentKnowledgeBaseDocumentsJson: string;
  /** JSON: tabella binding backend output → slot (`AgentBackendOutputSlotBindings`). */
  agentBackendOutputSlotBindingsJson: string;
  /** Modalità deploy ConvAI: legacy vs dialogo KB deterministico. */
  agentConvaiDeployMode: import('@domain/convai/agentConvaiDeployMode').AgentConvaiDeployMode;
}

/**
 * Builds the object passed to `taskRepository.updateTask` for AI Agent tasks.
 */
export function buildAIAgentTaskPersistPatch(state: AIAgentPersistState): Record<string, unknown> {
  const turns = state.previewByStyle[state.previewStyleId] ?? [];
  return {
    agentDesignDescription: state.designDescription,
    agentPrompt: state.agentPrompt,
    agentPromptTargetPlatform: state.agentPromptTargetPlatform,
    agentStructuredSectionsJson: state.agentStructuredSectionsJson,
    outputVariableMappings: { ...state.outputVariableMappings },
    agentProposedFields: state.proposedFields,
    agentPreviewByStyle: state.previewByStyle,
    agentPreviewStyleId: state.previewStyleId,
    agentSampleDialogue: previewTurnsToLegacySample(turns),
    agentInitialStateTemplateJson: state.initialStateTemplateJson,
    agentRuntimeCompactJson: state.agentRuntimeCompactJson,
    agentUseCaseGlobalStyleId: state.agentUseCaseGlobalStyleId,
    agentUseCaseStyleLearningNotes: state.agentUseCaseStyleLearningNotes,
    /** Implement/freeze removed from UX; always false so old tasks unlock on next save. */
    agentDesignFrozen: false,
    agentDesignHasGeneration: state.hasAgentGeneration,
    agentLogicalStepsJson: state.agentLogicalStepsJson,
    agentWizardStepOrderVersion: 4,
    agentUseCasesJson: state.agentUseCasesJson,
    agentStartPromptJson: state.agentStartPromptJson,
    agentStartUseCaseId: state.agentStartUseCaseId,
    agentConversationalRulesJson: state.agentConversationalRulesJson,
    agentUseCaseWizardStateJson: state.agentUseCaseWizardStateJson,
    agentIaRuntimeOverrideJson: state.agentIaRuntimeOverrideJson,
    agentImmediateStart: state.agentImmediateStart,
    agentConstructionPhase: state.agentConstructionPhase,
    agentWizardCurrentStep: state.agentWizardCurrentStep,
    agentWizardTutorAcknowledged: state.agentWizardTutorAcknowledged,
    agentConversationStyleExample: state.agentConversationStyleExample,
    agentConversationStyleAuto: state.agentConversationStyleAuto,
    agentConversationStyleSelections: state.agentConversationStyleSelections,
    agentConversationDeployStyleId: state.agentConversationDeployStyleId,
    agentLogUseCase: state.agentLogUseCase,
    agentLogBackendCalls: state.agentLogBackendCalls,
    agentBehavior: state.agentBehavior,
    agentInterfaceJson: state.agentInterfaceJson,
    agentKnowledgeBaseDocumentsJson: state.agentKnowledgeBaseDocumentsJson,
    agentBackendOutputSlotBindingsJson: state.agentBackendOutputSlotBindingsJson,
    agentConvaiDeployMode: state.agentConvaiDeployMode,
  };
}
