/**
 * Platform-based default config and field visibility for runtime IA agent setup UI.
 */

import type { IAAgentConfig, FieldVisibilityMap } from 'types/iaAgentRuntimeSetup';

const allFalse = (): FieldVisibilityMap => ({});

function v(map: FieldVisibilityMap, key: string, on: boolean): void {
  map[key] = on;
}

/** Fields aligned with provider docs / user matrix. */
export function getVisibleFields(platform: IAAgentConfig['platform']): FieldVisibilityMap {
  const out = allFalse();
  /** ElevenLabs: niente campo `model` top-level in UI (preset interno convai_default solo in persistenza). */
  v(out, 'model', platform !== 'elevenlabs');
  v(out, 'temperature', true);
  v(out, 'maxTokens', true);
  v(out, 'tools', true);
  /** Deprecated: edited only in the AI Agent task editor, not in runtime setup UI. */
  v(out, 'systemPrompt', false);

  switch (platform) {
    case 'openai':
      v(out, 'reasoning', false);
      v(out, 'top_p', true);
      v(out, 'frequency_penalty', true);
      v(out, 'presence_penalty', true);
      v(out, 'stop', true);
      v(out, 'seed', true);
      v(out, 'voice', false);
      v(out, 'workflow', false);
      v(out, 'conversation_settings', false);
      break;
    case 'anthropic':
      v(out, 'reasoning', true);
      v(out, 'top_p', true);
      v(out, 'stop_sequences', true);
      v(out, 'voice', false);
      break;
    case 'google':
      v(out, 'reasoning', false);
      v(out, 'top_p', true);
      v(out, 'top_k', true);
      v(out, 'max_output_tokens_alias', true);
      v(out, 'safety_settings', true);
      v(out, 'voice', false);
      break;
    case 'elevenlabs':
      v(out, 'reasoning', false);
      v(out, 'elevenlabs_instructions', true);
      v(out, 'llm_model', true);
      v(out, 'llm_temperature', true);
      v(out, 'llm_max_tokens', true);
      v(out, 'reflection_budget', true);
      v(out, 'voice', true);
      v(out, 'workflow', true);
      v(out, 'conversation_settings', true);
      break;
    case 'custom':
    default:
      v(out, 'reasoning', true);
      v(out, 'voice', false);
      break;
  }

  return out;
}

export function getDefaultConfig(platform: IAAgentConfig['platform']): IAAgentConfig {
  const base = {
    temperature: 0.7,
    maxTokens: 4096,
    reasoning: 'medium' as const,
    systemPrompt: '',
    tools: [] as IAAgentConfig['tools'],
    advanced: {} as Record<string, unknown>,
  };

  switch (platform) {
    case 'openai':
      return {
        platform: 'openai',
        model: 'gpt-4o',
        ...base,
        advanced: { top_p: 1, frequency_penalty: 0, presence_penalty: 0, stop: [], seed: null },
      };
    case 'anthropic':
      return {
        platform: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        ...base,
        advanced: { top_p: 0.95, stop_sequences: [] },
      };
    case 'google':
      return {
        platform: 'google',
        model: 'gemini-2.0-flash',
        ...base,
        maxTokens: 8192,
        advanced: { topP: 0.95, topK: 40, safetySettings: [] },
      };
    case 'elevenlabs':
      return {
        platform: 'elevenlabs',
        /** Preset ConvAI interno Omnia — non mostrato in UI; LLM reale è `advanced.llm`. */
        model: 'convai_default',
        ...base,
        systemPrompt: '',
        voice: { id: '', language: 'en', settings: {} },
        voices: [{ id: '', role: 'primary' as const }],
        advanced: {
          llm: {
            model: 'gpt-4o-mini',
            temperature: 0.5,
            max_tokens: 4096,
            reflection_budget: 3,
          },
          workflow: {},
          conversation_settings: {},
        },
      };
    case 'custom':
    default:
      return {
        platform: 'custom',
        model: 'default',
        ...base,
      };
  }
}
