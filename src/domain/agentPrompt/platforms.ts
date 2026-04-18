/**
 * Agent deployment targets for deterministic prompt compilation (toolbar + persisted task field).
 */

import { AgentPlatform } from './promptIr';

/** Market platforms only, alphabetical by product label (English). */
const ALPHABETICAL_MARKET_PLATFORMS: AgentPlatform[] = [
  AgentPlatform.Amazon,
  AgentPlatform.Anthropic,
  AgentPlatform.ElevenLabs,
  AgentPlatform.Google,
  AgentPlatform.Meta,
  AgentPlatform.OpenAI,
];

/** Canonical order for dropdowns: Omnia first, then separator, then alphabetical market list. */
export const AGENT_PROMPT_PLATFORM_IDS: AgentPlatform[] = [AgentPlatform.Omnia, ...ALPHABETICAL_MARKET_PLATFORMS];

/** Visual separator in `<select>` (disabled option). */
export const AGENT_PROMPT_PLATFORM_SELECT_SEPARATOR_VALUE = '__omnia_platform_sep__';

/** Product labels for toolbar / Task Editor dropdown. */
export const AGENT_PROMPT_PLATFORM_LABELS: Record<AgentPlatform, string> = {
  [AgentPlatform.Omnia]: 'Omnia',
  [AgentPlatform.OpenAI]: 'OpenAI Assistants',
  [AgentPlatform.Anthropic]: 'Anthropic Claude Workflows',
  [AgentPlatform.Google]: 'Google Gemini Agents',
  [AgentPlatform.Amazon]: 'Amazon Bedrock Agents',
  [AgentPlatform.ElevenLabs]: 'ElevenLabs Agents',
  [AgentPlatform.Meta]: 'Meta (Llama) Agents / OSS frameworks',
};

export const DEFAULT_AGENT_PROMPT_PLATFORM: AgentPlatform = AgentPlatform.Omnia;

/** Persisted `agentPromptTargetPlatform` string (enum value). */
export type AgentPromptPlatformId = AgentPlatform;

const LEGACY_PLATFORM_MAP: Record<string, AgentPlatform> = {
  omnia_ir_markdown: AgentPlatform.Omnia,
  openai_system_xml: AgentPlatform.OpenAI,
  anthropic_system_md: AgentPlatform.Anthropic,
  plain_text: AgentPlatform.Meta,
};

export function isAgentPromptPlatformId(v: string): v is AgentPromptPlatformId {
  return (AGENT_PROMPT_PLATFORM_IDS as readonly string[]).includes(v);
}

export function normalizeAgentPromptPlatformId(raw: string | undefined | null): AgentPlatform {
  if (raw === AGENT_PROMPT_PLATFORM_SELECT_SEPARATOR_VALUE) {
    return DEFAULT_AGENT_PROMPT_PLATFORM;
  }
  if (raw && isAgentPromptPlatformId(raw)) {
    return raw;
  }
  if (raw && LEGACY_PLATFORM_MAP[raw]) {
    return LEGACY_PLATFORM_MAP[raw];
  }
  return DEFAULT_AGENT_PROMPT_PLATFORM;
}

/**
 * Options for HTML `<select>`: Omnia, a disabled separator, then market platforms A–Z by label.
 */
export function getAgentPromptPlatformSelectOptions(): Array<{
  value: string;
  label: string;
  disabled?: boolean;
}> {
  return [
    { value: AgentPlatform.Omnia, label: AGENT_PROMPT_PLATFORM_LABELS[AgentPlatform.Omnia] },
    {
      value: AGENT_PROMPT_PLATFORM_SELECT_SEPARATOR_VALUE,
      label: '────────────',
      disabled: true,
    },
    ...ALPHABETICAL_MARKET_PLATFORMS.map((id) => ({
      value: id,
      label: AGENT_PROMPT_PLATFORM_LABELS[id],
    })),
  ];
}
