/**
 * Maps in-memory AI Agent editor state to the flat Task patch for TaskRepository.
 */

import { previewTurnsToLegacySample } from '@types/aiAgentPreview';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';

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
  hasAgentGeneration: boolean;
  agentLogicalStepsJson: string;
  agentUseCasesJson: string;
  agentIaRuntimeOverrideJson: string;
  agentImmediateStart: boolean;
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
    /** Implement/freeze removed from UX; always false so old tasks unlock on next save. */
    agentDesignFrozen: false,
    agentDesignHasGeneration: state.hasAgentGeneration,
    agentLogicalStepsJson: state.agentLogicalStepsJson,
    agentUseCasesJson: state.agentUseCasesJson,
    agentIaRuntimeOverrideJson: state.agentIaRuntimeOverrideJson,
    agentImmediateStart: state.agentImmediateStart,
  };
}
