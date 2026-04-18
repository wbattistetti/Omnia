/**
 * Deterministic compilation of {@link AgentStructuredSections} to a preview string.
 * Delegates structured shaping to {@link compilePromptFromStructuredSections} / {@link formatPlatformPromptOutput}.
 */

import { composeOmniaIrMarkdown } from './compileInternals';
import { compilePromptFromStructuredSections, formatPlatformPromptOutput } from './compilePrompt';
import { normalizeAgentPromptPlatformId } from './platforms';
import type { AgentStructuredSections } from './types';

export interface CompileAgentPromptOptions {
  /** When false, placeholder tokens are left as-is. Default true. */
  expandPlaceholderTokens?: boolean;
}

export { composeOmniaIrMarkdown } from './compileInternals';
export { expandAgentPromptMarkdown } from './compileInternals';

/**
 * Compiles rich IR to one platform-specific prompt string (flattened preview).
 * When {@link CompileAgentPromptOptions.expandPlaceholderTokens} is false, returns IR Markdown with raw `{{omniabp:…}}` tokens.
 */
export function compileAgentPromptToPlatform(
  ir: AgentStructuredSections,
  platform: string,
  options?: CompileAgentPromptOptions
): string {
  const expand = options?.expandPlaceholderTokens !== false;
  const p = normalizeAgentPromptPlatformId(platform);
  if (!expand) {
    return composeOmniaIrMarkdown(ir);
  }
  return formatPlatformPromptOutput(compilePromptFromStructuredSections(ir, p));
}
