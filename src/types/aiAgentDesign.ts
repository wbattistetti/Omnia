/**
 * Design-time payload returned by POST /design/ai-agent-generate.
 * Used to populate the AI Agent task editor before runtime execution.
 */

export interface AIAgentProposedVariable {
  /** Chiave snake_case in updated_state (JSON / LLM). */
  field_name: string;
  /** Nome variabile in Omnia (può contenere spazi). */
  label: string;
  /** Tipo semantico: id da `DATA_ENTITY_TYPES` / dataEntityTypes.ts. */
  type: string;
  required: boolean;
}

export interface AIAgentDesignSampleTurn {
  role: 'assistant' | 'user';
  content: string;
}

/**
 * Structured runtime instructions (composed server-side into Markdown `agent_prompt`).
 */
export interface AIAgentStructuredSectionTexts {
  behavior_spec: string;
  positive_constraints: string;
  negative_constraints: string;
  operational_sequence: string;
  correction_rules: string;
  /** Optional; may be empty when not used. */
  conversational_state: string;
}

export interface AIAgentDesignPayload extends AIAgentStructuredSectionTexts {
  proposed_variables: AIAgentProposedVariable[];
  initial_state_template: Record<string, unknown>;
  /** Assembled Markdown runtime prompt (read-only in UI). */
  agent_prompt: string;
  sample_dialogue: AIAgentDesignSampleTurn[];
  design_notes: string;
}

export interface AIAgentDesignApiSuccess {
  success: true;
  design: AIAgentDesignPayload;
}

export interface AIAgentDesignApiError {
  success: false;
  error: string;
  rawSnippet?: string;
}
