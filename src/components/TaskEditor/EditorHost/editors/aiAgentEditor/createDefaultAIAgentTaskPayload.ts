/**
 * Default persisted fields when creating a new AI Agent task in the repository.
 */

import { AI_AGENT_DEFAULT_PREVIEW_STYLE_ID } from '@types/aiAgentPreview';
import { EMPTY_OUTPUT_MAPPINGS } from './constants';

/**
 * Payload passed to `taskRepository.createTask` for a fresh AI Agent row.
 */
export function createDefaultAIAgentTaskPayload(): Record<string, unknown> {
  return {
    agentDesignDescription: '',
    agentPrompt: '',
    agentStructuredSectionsJson: '',
    outputVariableMappings: { ...EMPTY_OUTPUT_MAPPINGS },
    agentProposedFields: [],
    agentSampleDialogue: [],
    agentPreviewByStyle: {},
    agentPreviewStyleId: AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
    agentInitialStateTemplateJson: '{}',
    agentDesignFrozen: false,
    agentDesignHasGeneration: false,
    agentLogicalStepsJson: '[]',
    agentUseCasesJson: '[]',
  };
}
