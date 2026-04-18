/**
 * Assembles the read-only composed agent prompt (IR Markdown) from structured section texts.
 * Delegates to domain {@link composeOmniaIrMarkdown} so order/headings stay aligned with compilation.
 */

import { buildAgentStructuredSections, composeOmniaIrMarkdown } from '@domain/agentPrompt';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import {
  AGENT_STRUCTURED_SECTION_IDS,
  AGENT_STRUCTURED_SECTION_LABELS,
  AGENT_STRUCTURED_SECTION_PROMPT_HEADINGS,
} from './agentStructuredSectionIds';

/**
 * Builds Markdown with ### headers per section. Omits empty Context and Examples (whitespace-only).
 */
export function composeRuntimePromptMarkdown(
  effectiveBySection: Record<AgentStructuredSectionId, string>
): string {
  const ir = buildAgentStructuredSections(
    {
      goal: effectiveBySection.goal ?? '',
      operational_sequence: effectiveBySection.operational_sequence ?? '',
      context: effectiveBySection.context ?? '',
      constraints: effectiveBySection.constraints ?? '',
      personality: effectiveBySection.personality ?? '',
      tone: effectiveBySection.tone ?? '',
      examples: effectiveBySection.examples ?? '',
    },
    []
  );
  return composeOmniaIrMarkdown(ir);
}

/**
 * Concatenates section bodies for refine context (natural language bundle for the LLM).
 */
export function buildRefineUserDescFromSections(
  effectiveBySection: Record<AgentStructuredSectionId, string>
): string {
  const parts: string[] = [];
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    const label = AGENT_STRUCTURED_SECTION_LABELS[id];
    const heading = AGENT_STRUCTURED_SECTION_PROMPT_HEADINGS[id];
    const text = (effectiveBySection[id] ?? '').trim();
    parts.push(`${label} (${heading}):\n${text || '—'}`);
  }
  return parts.join('\n\n---\n\n');
}
