/**
 * Design-time payload returned by POST /design/ai-agent-generate.
 * Used to populate the AI Agent task editor before runtime execution.
 */

/**
 * Persisted / editor shape: identity is slotId (GUID). Labels are human-editable.
 */
export interface AIAgentProposedVariable {
  slotId: string;
  /** Display / flow variable label (may include spaces). */
  label: string;
  /** Semantic type id from `DATA_ENTITY_TYPES` / dataEntityTypes.ts. */
  type: string;
  required: boolean;
}

/**
 * Wire row from POST /design/ai-agent-generate. The LLM may include field_name for
 * initial_state_template JSON keys; Omnia assigns slotId on ingest and does not use field_name as a binding key.
 */
export interface AIAgentLlmProposedVariableRow {
  field_name: string;
  label: string;
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
  proposed_variables: AIAgentLlmProposedVariableRow[];
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
