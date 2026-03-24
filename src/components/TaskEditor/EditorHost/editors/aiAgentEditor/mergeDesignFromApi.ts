/**
 * Pure helpers to apply LLM design-time responses into editor state shapes.
 */

import type { AIAgentDesignPayload, AIAgentProposedVariable } from '@types/aiAgentDesign';
import { normalizeEntityType } from '@types/dataEntityTypes';
import { seedPreviewByStyleFromSample } from '@types/aiAgentPreview';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { formatOperationalSequenceNewlines } from './operationalSequenceDisplay';
import { createAgentOutputSlotId } from './aiAgentSlotIdentity';

/**
 * Maps LLM design rows to editor variables: assigns a new slotId per row (never uses field_name as identity).
 */
export function proposedFieldsFromDesignPayload(
  design: AIAgentDesignPayload
): AIAgentProposedVariable[] {
  return design.proposed_variables.map((v) => ({
    slotId: createAgentOutputSlotId(),
    label: v.label,
    type: normalizeEntityType(v.type),
    required: Boolean(v.required),
  }));
}

/**
 * Ensures each new slotId has a mapping entry (empty string until linked to a project variable).
 */
export function extendOutputMappingsForNewSlotIds(
  previous: Record<string, string>,
  slotIds: string[]
): Record<string, string> {
  const next = { ...previous };
  for (const id of slotIds) {
    if (!(id in next)) {
      next[id] = '';
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
  const proposedFields = proposedFieldsFromDesignPayload(design);
  const slotIds = proposedFields.map((p) => p.slotId);
  return {
    proposedFields,
    agentPrompt: design.agent_prompt.trim(),
    sectionBases: sectionTextsFromDesignPayload(design),
    previewByStyle: seedPreviewByStyleFromSample(design.sample_dialogue),
    initialStateTemplateJson: JSON.stringify(design.initial_state_template, null, 2),
    mergeOutputMappings: (previous) => extendOutputMappingsForNewSlotIds(previous, slotIds),
  };
}
