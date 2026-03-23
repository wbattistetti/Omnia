/**
 * Canonical IDs for structured AI Agent design sections (aligned with backend JSON keys).
 */

/** Order: Descrizione (separate tab) → Behavior → Sequenza → Vincoli ± → Regole → Stato → Prompt finale (separate). */
export const AGENT_STRUCTURED_SECTION_IDS = [
  'behavior_spec',
  'operational_sequence',
  'positive_constraints',
  'negative_constraints',
  'correction_rules',
  'conversational_state',
] as const;

export type AgentStructuredSectionId = (typeof AGENT_STRUCTURED_SECTION_IDS)[number];

/** UI labels (Italian) for section headings. */
export const AGENT_STRUCTURED_SECTION_LABELS: Record<AgentStructuredSectionId, string> = {
  behavior_spec: 'Behavior',
  operational_sequence: 'Sequenza operativa',
  positive_constraints: 'Vincoli positivi',
  negative_constraints: 'Vincoli negativi',
  correction_rules: 'Regole di correzione',
  conversational_state: 'Stato conversazionale',
};

/** Tooltip for tab title (accessibility + “cosa significa”). */
export const AGENT_STRUCTURED_SECTION_TAB_TITLE: Partial<Record<AgentStructuredSectionId, string>> = {
  conversational_state:
    'Memoria e fasi della conversazione: cosa è già stato chiesto, obiettivi intermedi, stato del flusso.',
};
