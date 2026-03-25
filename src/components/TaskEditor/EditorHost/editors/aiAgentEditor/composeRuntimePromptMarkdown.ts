/**
 * Assembles the read-only runtime agent prompt (Markdown) from structured section texts.
 */

import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import {
  AGENT_STRUCTURED_SECTION_IDS,
  AGENT_STRUCTURED_SECTION_LABELS,
  AGENT_STRUCTURED_SECTION_PROMPT_HEADINGS,
} from './agentStructuredSectionIds';

const SECTION_ORDER_FOR_PROMPT: AgentStructuredSectionId[] = [
  'goal',
  'operational_sequence',
  'context',
  'constraints',
  'personality',
  'tone',
];

/**
 * Builds Markdown with ### headers per section. Omits Context when empty (whitespace).
 */
export function composeRuntimePromptMarkdown(
  effectiveBySection: Record<AgentStructuredSectionId, string>
): string {
  const chunks: string[] = [];
  for (const id of SECTION_ORDER_FOR_PROMPT) {
    const body = (effectiveBySection[id] ?? '').trim();
    if (id === 'context' && !body) continue;
    const title = AGENT_STRUCTURED_SECTION_PROMPT_HEADINGS[id];
    chunks.push(`### ${title}\n\n${body.length > 0 ? body : '—'}`);
  }
  return chunks.join('\n\n').trim();
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
