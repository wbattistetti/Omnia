/**
 * Pure helpers to apply LLM design-time responses into editor state shapes.
 */

import type { AIAgentDesignPayload, AIAgentProposedVariable } from '@types/aiAgentDesign';
import { normalizeEntityType } from '@types/dataEntityTypes';
import { seedPreviewByStyleFromSample } from '@types/aiAgentPreview';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { formatOperationalSequenceNewlines } from './operationalSequenceDisplay';

/**
 * Normalizes proposed variables from the API payload.
 */
export function proposedFieldsFromDesignPayload(
  design: AIAgentDesignPayload
): AIAgentProposedVariable[] {
  return design.proposed_variables.map((v) => ({
    ...v,
    type: normalizeEntityType(v.type),
  }));
}

/**
 * Ensures each new field_name has a mapping slot (empty string until linked).
 */
export function extendOutputMappingsForNewKeys(
  previous: Record<string, string>,
  fieldNames: string[]
): Record<string, string> {
  const next = { ...previous };
  for (const name of fieldNames) {
    if (!(name in next)) {
      next[name] = '';
    }
  }
  return next;
}

export interface GenerateDesignApplyResult {
  proposedFields: AIAgentProposedVariable[];
  agentPrompt: string;
  sectionBases: Record<AgentStructuredSectionId, string>;
  previewByStyle: ReturnType<typeof seedPreviewByStyleFromSample>;
  initialStateTemplateJson: string;
  mergeOutputMappings: (previous: Record<string, string>) => Record<string, string>;
}

/**
 * Canonical section strings from an API design payload (Monaco bases after generate/refine).
 */
export function sectionTextsFromDesignPayload(
  design: AIAgentDesignPayload
): Record<AgentStructuredSectionId, string> {
  return {
    behavior_spec: design.behavior_spec.trim(),
    positive_constraints: design.positive_constraints.trim(),
    negative_constraints: design.negative_constraints.trim(),
    operational_sequence: formatOperationalSequenceNewlines(design.operational_sequence),
    correction_rules: design.correction_rules.trim(),
    conversational_state:
      typeof design.conversational_state === 'string' ? design.conversational_state.trim() : '',
  };
}

/**
 * Maps a successful `generateAIAgentDesign` response into editor state fragments.
 */
export function applyGenerateDesignPayload(design: AIAgentDesignPayload): GenerateDesignApplyResult {
  const keys = design.proposed_variables.map((v) => v.field_name);
  return {
    proposedFields: proposedFieldsFromDesignPayload(design),
    agentPrompt: design.agent_prompt.trim(),
    sectionBases: sectionTextsFromDesignPayload(design),
    previewByStyle: seedPreviewByStyleFromSample(design.sample_dialogue),
    initialStateTemplateJson: JSON.stringify(design.initial_state_template, null, 2),
    mergeOutputMappings: (previous) => extendOutputMappingsForNewKeys(previous, keys),
  };
}
