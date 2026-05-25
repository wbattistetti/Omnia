/**
 * Editable task text fields that support observation review (description + structured IR sections).
 */

import {
  AGENT_STRUCTURED_SECTION_IDS,
  AGENT_STRUCTURED_SECTION_LABELS,
  type AgentStructuredSectionId,
} from '@omnia/domain-core/task/sections/agentStructuredSectionIds';

export type AgentTaskTextFieldId = 'designDescription' | AgentStructuredSectionId;

/** All fields with a designer-editable markdown surface in the agent editor. */
export const AGENT_TASK_TEXT_EDITABLE_FIELD_IDS: readonly AgentTaskTextFieldId[] = [
  'designDescription',
  ...AGENT_STRUCTURED_SECTION_IDS,
];

export function agentTaskTextFieldLabel(fieldId: AgentTaskTextFieldId): string {
  if (fieldId === 'designDescription') return 'Descrizione task';
  return AGENT_STRUCTURED_SECTION_LABELS[fieldId];
}
