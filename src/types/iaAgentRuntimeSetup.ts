/**
 * Runtime IA agent motor configuration for flow execution (designer settings + per-task overrides).
 */

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema object describing tool parameters. */
  inputSchema: Record<string, unknown>;
}

export type IAAgentReasoningLevel = 'none' | 'low' | 'medium' | 'high';

export type IAAgentPlatform = 'elevenlabs' | 'openai' | 'anthropic' | 'google' | 'custom';

export interface IAAgentVoiceConfig {
  id: string;
  /** Locale principale (primo elemento se `languages` è valorizzato). */
  language: string;
  /** Lingue aggiuntive per agenti multilingua (ConvAI-style); la prima coincide con `language`. */
  languages?: string[];
  settings?: Record<string, unknown>;
}

/** ConvAI-style voice lineup: one primary + up to three secondary (no reorder). */
export type IAAgentVoiceRole = 'primary' | 'secondary';

export interface IAAgentVoiceEntry {
  id: string;
  role: IAAgentVoiceRole;
}

/**
 * Unified runtime agent config. Platform-specific knobs are merged into `advanced`
 * when not modeled as top-level fields.
 */
export interface IAAgentConfig {
  platform: IAAgentPlatform;
  model: string;
  temperature: number;
  maxTokens: number;
  reasoning: IAAgentReasoningLevel;
  /**
   * @deprecated Configured only in the AI Agent task editor. Kept for persistence until transition completes.
   */
  systemPrompt: string;
  tools: ToolDefinition[];
  /**
   * Task Backend Call (GUID) da esporre come tool ConvAI (oltre ai tool manuali in `tools`).
   * Naming e schema sono derivati dal task (vedi `@domain/iaAgentTools/backendToolDerivation`).
   */
  convaiBackendToolTaskIds?: string[];
  voice?: IAAgentVoiceConfig;
  /** Preferred over `voice` for ElevenLabs when set (1 primary + max 3 secondary). */
  voices?: IAAgentVoiceEntry[];
  /** ConvAI agent id — used when `platform === 'elevenlabs'` at compile/runtime. */
  convaiAgentId?: string;
  /**
   * Modello sintesi vocale ElevenLabs (`tts.model_id` in ConvAI). Catalogo da GET `/v1/models` filtrato `eleven_*`.
   * Vuoto = default Omnia per lingua (`eleven_flash_v2` se `en`, altrimenti `eleven_flash_v2_5`).
   */
  ttsModel?: string;
  /**
   * Solo client / persistenza task: dopo cambio `ttsModel` con ConvAI già creato, il prossimo avvio flusso
   * esegue `createAgent` di nuovo (conversation_config con TTS) e aggiorna `convaiAgentId`. Non va a ElevenLabs come campo top-level.
   */
  elevenLabsNeedsReprovision?: boolean;
  /** Optional base URL for ApiServer `/elevenlabs/*`; default env / localhost in VB. */
  elevenLabsBackendBaseUrl?: string;
  advanced?: Record<string, unknown>;
}

/**
 * Visibility of API-aligned fields per platform (see `getVisibleFields`).
 */
export type FieldVisibilityMap = Record<string, boolean>;
