/**
 * Canonical Prompt IR shape for multi-platform agent compilation (authoring view-model).
 * Maps from {@link AgentStructuredSections} via {@link agentStructuredSectionsToPromptIR}.
 */

/** Market agent runtimes supported for deterministic compile previews. */
export enum AgentPlatform {
  /** Omnia IR Markdown (design-time source layout, bracket placeholder expansion). */
  Omnia = 'omnia',
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Google = 'google',
  Amazon = 'amazon',
  ElevenLabs = 'elevenlabs',
  Meta = 'meta',
}

/**
 * Rich prompt IR (platform-neutral). Persisted source of truth in Omnia is
 * {@link import('./types').AgentStructuredSections}; this type is the normalized projection.
 */
export interface PromptIR {
  goal: string;
  persona: string;
  style: string;
  rules: string[];
  examples: Array<{ user: string; agent: string }>;
  /** Declared or inferred JSON Schema for structured outputs (optional). */
  outputSchema: unknown;
  context: string;
}

/** Structured compile result for OpenAI Assistants-style targets. */
export interface PlatformPromptOpenAI {
  platform: AgentPlatform.OpenAI;
  instructions: string;
  tools: string;
  examples: string;
  retrieval: string;
  metadata: string;
}

export interface PlatformPromptAnthropic {
  platform: AgentPlatform.Anthropic;
  system: string;
  policies: string;
  workflowSteps: string;
}

export interface PlatformPromptGoogle {
  platform: AgentPlatform.Google;
  system: string;
  safety: string;
  toolSchemas: string;
}

export interface PlatformPromptAmazon {
  platform: AgentPlatform.Amazon;
  instructions: string;
  actionGroups: string;
  guardrails: string;
}

export interface PlatformPromptElevenLabs {
  platform: AgentPlatform.ElevenLabs;
  prompt: string;
}

export interface PlatformPromptMeta {
  platform: AgentPlatform.Meta;
  prompt: string;
}

/** Omnia-native IR Markdown preview (not an external vendor runtime). */
export interface PlatformPromptOmnia {
  platform: AgentPlatform.Omnia;
  irMarkdown: string;
}

/** Union of all platform-specific compile outputs. */
export type PlatformPromptOutput =
  | PlatformPromptOmnia
  | PlatformPromptOpenAI
  | PlatformPromptAnthropic
  | PlatformPromptGoogle
  | PlatformPromptAmazon
  | PlatformPromptElevenLabs
  | PlatformPromptMeta;
