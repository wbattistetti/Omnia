/**
 * Tests for Markdown composition of structured AI Agent sections.
 */

import { describe, expect, it } from 'vitest';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { composeRuntimePromptMarkdown, buildRefineUserDescFromSections } from './composeRuntimePromptMarkdown';

const sample = (): Record<AgentStructuredSectionId, string> => ({
  behavior_spec: 'A',
  positive_constraints: 'B',
  negative_constraints: 'C',
  operational_sequence: 'D',
  correction_rules: 'E',
  conversational_state: '',
});

describe('composeRuntimePromptMarkdown', () => {
  it('omits empty conversational_state section', () => {
    const md = composeRuntimePromptMarkdown(sample());
    expect(md).toContain('## Behavior Spec');
    expect(md).toContain('A');
    expect(md).not.toContain('Stato conversazionale');
  });

  it('includes conversational_state when non-empty', () => {
    const s = sample();
    s.conversational_state = 'State notes';
    const md = composeRuntimePromptMarkdown(s);
    expect(md).toContain('Stato conversazionale');
    expect(md).toContain('State notes');
  });
});

describe('buildRefineUserDescFromSections', () => {
  it('joins all sections with separators', () => {
    const t = buildRefineUserDescFromSections(sample());
    expect(t).toContain('Behavior Spec');
    expect(t).toContain('---');
    expect(t).toContain('A');
  });
});
