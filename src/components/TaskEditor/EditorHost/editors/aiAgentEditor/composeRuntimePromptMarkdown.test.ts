/**
 * Tests for Markdown composition of structured AI Agent sections.
 */

import { describe, expect, it } from 'vitest';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { composeRuntimePromptMarkdown, buildRefineUserDescFromSections } from './composeRuntimePromptMarkdown';

const sample = (): Record<AgentStructuredSectionId, string> => ({
  goal: 'G',
  operational_sequence: 'S',
  context: '',
  constraints: 'Must:\n\nM\n\nMust not:\n\nN',
  personality: 'P',
  tone: 'Tone: neutral\n\nT',
  examples: '',
});

describe('composeRuntimePromptMarkdown', () => {
  it('includes Goal and omits empty Context from composed markdown', () => {
    const md = composeRuntimePromptMarkdown(sample());
    expect(md).toContain('### Goal');
    expect(md).toContain('G');
    expect(md).not.toContain('### Context');
  });

  it('includes Context when non-empty', () => {
    const s = sample();
    s.context = 'Ctx';
    const md = composeRuntimePromptMarkdown(s);
    expect(md).toContain('### Context');
    expect(md).toContain('Ctx');
  });
});

describe('buildRefineUserDescFromSections', () => {
  it('joins all sections with separators', () => {
    const t = buildRefineUserDescFromSections(sample());
    expect(t).toContain('Scopo');
    expect(t).toContain('---');
    expect(t).toContain('Tone: neutral');
  });
});
