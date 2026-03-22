/**
 * Canonical IDs for structured AI Agent design sections (aligned with backend JSON keys).
 */

export const AGENT_STRUCTURED_SECTION_IDS = [
  'behavior_spec',
  'positive_constraints',
  'negative_constraints',
  'operational_sequence',
  'correction_rules',
  'conversational_state',
] as const;

export type AgentStructuredSectionId = (typeof AGENT_STRUCTURED_SECTION_IDS)[number];

/** UI labels (Italian) for section headings. */
export const AGENT_STRUCTURED_SECTION_LABELS: Record<AgentStructuredSectionId, string> = {
  behavior_spec: 'Behavior Spec',
  positive_constraints: 'Vincoli positivi',
  negative_constraints: 'Vincoli negativi',
  operational_sequence: 'Sequenza operativa',
  correction_rules: 'Regole di correzione',
  conversational_state: 'Stato conversazionale',
};
