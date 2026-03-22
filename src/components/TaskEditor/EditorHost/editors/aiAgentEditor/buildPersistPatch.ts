/**
 * Maps in-memory AI Agent editor state to the flat Task patch for TaskRepository.
 */

import { previewTurnsToLegacySample } from '@types/aiAgentPreview';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';

export interface AIAgentPersistState {
  designDescription: string;
  agentPrompt: string;
  /** Serialized `PersistedStructuredSections`. */
  agentStructuredSectionsJson: string;
  outputVariableMappings: Record<string, string>;
  proposedFields: AIAgentProposedVariable[];
  previewByStyle: Record<string, AIAgentPreviewTurn[]>;
  previewStyleId: string;
  initialStateTemplateJson: string;
  hasAgentGeneration: boolean;
  agentLogicalStepsJson: string;
  agentUseCasesJson: string;
}

/**
 * Builds the object passed to `taskRepository.updateTask` for AI Agent tasks.
 */
export function buildAIAgentTaskPersistPatch(state: AIAgentPersistState): Record<string, unknown> {
  const turns = state.previewByStyle[state.previewStyleId] ?? [];
  return {
    agentDesignDescription: state.designDescription,
    agentPrompt: state.agentPrompt,
    agentStructuredSectionsJson: state.agentStructuredSectionsJson,
    outputVariableMappings: { ...state.outputVariableMappings },
    agentProposedFields: state.proposedFields,
    agentPreviewByStyle: state.previewByStyle,
    agentPreviewStyleId: state.previewStyleId,
    agentSampleDialogue: previewTurnsToLegacySample(turns),
    agentInitialStateTemplateJson: state.initialStateTemplateJson,
    /** Implement/freeze removed from UX; always false so old tasks unlock on next save. */
    agentDesignFrozen: false,
    agentDesignHasGeneration: state.hasAgentGeneration,
    agentLogicalStepsJson: state.agentLogicalStepsJson,
    agentUseCasesJson: state.agentUseCasesJson,
  };
}
