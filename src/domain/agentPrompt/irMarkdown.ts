/**
 * Canonical section order and English Markdown H3 titles for Omnia IR composition.
 * Keep in sync with AI Agent structured section IDs in the editor.
 */

export const AGENT_IR_MARKDOWN_SECTION_ORDER = [
  'goal',
  'operational_sequence',
  'context',
  'constraints',
  'personality',
  'tone',
  'examples',
] as const;

export type AgentIrMarkdownSectionKey = (typeof AGENT_IR_MARKDOWN_SECTION_ORDER)[number];

/** Stable English headings for composed IR / platform previews. */
export const AGENT_IR_MARKDOWN_HEADINGS: Record<AgentIrMarkdownSectionKey, string> = {
  goal: 'Goal',
  operational_sequence: 'Operational sequence',
  context: 'Context',
  constraints: 'Guardrails',
  personality: 'Personality',
  tone: 'Tone',
  examples: 'Examples',
};
