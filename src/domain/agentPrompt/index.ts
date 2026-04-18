/**
 * Agent prompt IR: structured sections, backend placeholders, deterministic multi-platform compile.
 */

export type {
  AgentStructuredSections,
  BackendPlaceholderDefinition,
  BackendPlaceholderInstance,
} from './types';
export type {
  PromptIR,
  PlatformPromptOutput,
  PlatformPromptOpenAI,
  PlatformPromptAnthropic,
  PlatformPromptGoogle,
  PlatformPromptAmazon,
  PlatformPromptElevenLabs,
  PlatformPromptMeta,
  PlatformPromptOmnia,
} from './promptIr';
export { AgentPlatform } from './promptIr';
export { agentStructuredSectionsToPromptIR, parseExamplesSection } from './agentStructuredSectionsToPromptIR';
export {
  compilePrompt,
  compilePromptFromStructuredSections,
  formatPlatformPromptOutput,
  splitExpandedAtExamplesMarkdown,
  type CompilePromptOptions,
} from './compilePrompt';
export { expandAgentPromptMarkdown } from './compileInternals';
export {
  AGENT_PROMPT_PLATFORM_IDS,
  AGENT_PROMPT_PLATFORM_LABELS,
  AGENT_PROMPT_PLATFORM_SELECT_SEPARATOR_VALUE,
  DEFAULT_AGENT_PROMPT_PLATFORM,
  getAgentPromptPlatformSelectOptions,
  type AgentPromptPlatformId,
  isAgentPromptPlatformId,
  normalizeAgentPromptPlatformId,
} from './platforms';
export { BACKEND_PLACEHOLDER_DEFINITIONS, getBackendPlaceholderDefinition } from './backendPlaceholderRegistry';
export {
  BACKEND_TOKEN_ICON,
  BACKEND_DISPLAY_TOKEN_REGEX,
  formatBackendDisplayToken,
} from './backendPathDisplay';
export { collectBackendRowPathsFromActiveFlow } from './collectBackendRowPathsFromActiveFlow';
export {
  OMNIABP_TOKEN_REGEX,
  extractOmniabpInstanceIds,
  makeOmniabpToken,
  validatePlaceholderInstancesAgainstText,
} from './tokens';
export { buildAgentStructuredSections, type AgentIrSectionTexts } from './buildAgentStructuredSections';
export {
  compileAgentPromptToPlatform,
  composeOmniaIrMarkdown,
  type CompileAgentPromptOptions,
} from './compileAgentPrompt';
export { AGENT_IR_MARKDOWN_HEADINGS, AGENT_IR_MARKDOWN_SECTION_ORDER } from './irMarkdown';
