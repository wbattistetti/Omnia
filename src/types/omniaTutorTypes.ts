/**
 * Designer-only LLM configuration (Omnia Tutor). Not used for runtime agents or end-user chat.
 */

export type OmniaTutorReasoningLevel = 'none' | 'low' | 'medium' | 'high';

export interface OmniaTutorConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  reasoning: OmniaTutorReasoningLevel;
  safety?: Record<string, unknown>;
}
