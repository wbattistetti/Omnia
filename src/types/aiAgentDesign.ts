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
 * Six sections: goal → steps → context → guardrails (Must / Must not) → role → register (`tone`).
 */
export interface AIAgentStructuredSectionTexts {
  goal: string;
  operational_sequence: string;
  context: string;
  /** Must / Must not structure (see meta-prompt). */
  constraints: string;
  personality: string;
  /** First line `Tone: <token>` — see aiAgentStructuredSectionEnums. */
  tone: string;
  /** Optional few-shot / style examples (optional in LLM JSON). */
  examples?: string;
}

/**
 * Token-efficient runtime instructions from design-time JSON (persisted as `agentRuntimeCompactJson`).
 */
export interface AIAgentRuntimeCompact {
  behavior_compact: string;
  constraints_compact: string;
  sequence_compact: string;
  corrections_compact: string;
  examples_compact: AIAgentDesignSampleTurn[];
}

export interface AIAgentDesignPayload extends AIAgentStructuredSectionTexts {
  proposed_variables: AIAgentLlmProposedVariableRow[];
  initial_state_template: Record<string, unknown>;
  /** Assembled Markdown runtime prompt (read-only in UI). */
  agent_prompt: string;
  sample_dialogue: AIAgentDesignSampleTurn[];
  design_notes: string;
  /** Required on successful generate/refine; used for compile/runtime preview and engine rules. */
  runtime_compact: AIAgentRuntimeCompact;
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
