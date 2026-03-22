/**
 * Assembles the read-only runtime agent prompt (Markdown) from structured section texts.
 */

import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS, AGENT_STRUCTURED_SECTION_LABELS } from './agentStructuredSectionIds';

const SECTION_ORDER_FOR_PROMPT: AgentStructuredSectionId[] = [
  'behavior_spec',
  'positive_constraints',
  'negative_constraints',
  'operational_sequence',
  'correction_rules',
  'conversational_state',
];

/**
 * Builds Markdown with ## headers per section. Omits conversational_state when empty/whitespace.
 */
export function composeRuntimePromptMarkdown(
  effectiveBySection: Record<AgentStructuredSectionId, string>
): string {
  const chunks: string[] = [];
  for (const id of SECTION_ORDER_FOR_PROMPT) {
    const body = (effectiveBySection[id] ?? '').trim();
    if (id === 'conversational_state' && !body) {
      continue;
    }
    const title = AGENT_STRUCTURED_SECTION_LABELS[id];
    chunks.push(`## ${title}\n\n${body.length > 0 ? body : '—'}`);
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
    const text = (effectiveBySection[id] ?? '').trim();
    parts.push(`${label}:\n${text || '—'}`);
  }
  return parts.join('\n\n---\n\n');
}
