/**
 * Canonical IDs for structured AI Agent design sections (aligned with backend JSON keys).
 * Order: Goal → operational steps → context → constraints → personality → tone.
 */

export const AGENT_STRUCTURED_SECTION_IDS = [
  'goal',
  'operational_sequence',
  'context',
  'constraints',
  'personality',
  'tone',
] as const;

export type AgentStructuredSectionId = (typeof AGENT_STRUCTURED_SECTION_IDS)[number];

/** UI labels (Italian) for section tabs. */
export const AGENT_STRUCTURED_SECTION_LABELS: Record<AgentStructuredSectionId, string> = {
  goal: 'Scopo',
  operational_sequence: 'Sequenza operativa',
  context: 'Contesto',
  constraints: 'Vincoli',
  personality: 'Personalità',
  tone: 'Tono',
};

/** Markdown H3 titles for the read-only composed agent prompt (English, stable). */
export const AGENT_STRUCTURED_SECTION_PROMPT_HEADINGS: Record<AgentStructuredSectionId, string> = {
  goal: 'Goal',
  operational_sequence: 'Operational sequence',
  context: 'Context',
  constraints: 'Guardrails',
  personality: 'Personality',
  tone: 'Tone',
};

/** Tooltip for tab title (accessibility). */
export const AGENT_STRUCTURED_SECTION_TAB_TITLE: Partial<Record<AgentStructuredSectionId, string>> = {
  goal: 'Cosa deve ottenere l’agente a fine conversazione.',
  operational_sequence:
    'Ordine di domande, raccolta dati, conferme e correzioni.',
  context: 'Dove avviene la conversazione, chi è l’utente, cosa è già noto.',
  constraints: 'Must e Must not: obblighi e divieti.',
  personality: 'Chi è l’agente: ruolo e atteggiamento.',
  tone: 'Come parla: registro, brevità, chiarezza (prima riga Tone: …).',
};
