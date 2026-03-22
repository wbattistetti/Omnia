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

export interface AIAgentDesignPayload {
  proposed_variables: AIAgentProposedVariable[];
  initial_state_template: Record<string, unknown>;
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
