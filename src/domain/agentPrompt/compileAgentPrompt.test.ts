import { describe, expect, it } from 'vitest';
import { composeOmniaIrMarkdown } from './compileInternals';
import { compileAgentPromptToPlatform } from './compileAgentPrompt';
import { AgentPlatform } from './promptIr';
import type { AgentStructuredSections } from './types';
import { makeOmniabpToken } from './tokens';

function baseIr(): AgentStructuredSections {
  const id = '550e8400-e29b-41d4-a716-446655440000';
  return {
    goal: 'Collect user name.',
    operational_sequence: 'Ask; confirm.',
    context: '',
    constraints: 'Must:\n\nx\n\nMust not:\n\ny',
    personality: 'Helpful.',
    tone: 'Tone: neutral\n\nShort.',
    examples: '',
    backendPlaceholders: [{ id, definitionId: 'user_utterance_in' }],
  };
}

describe('compileAgentPromptToPlatform', () => {
  it('is deterministic for the same IR and platform', () => {
    const ir = baseIr();
    ir.goal = `Collect user name. ${makeOmniabpToken('550e8400-e29b-41d4-a716-446655440000')}`;
    const a = compileAgentPromptToPlatform(ir, AgentPlatform.OpenAI);
    const b = compileAgentPromptToPlatform(ir, AgentPlatform.OpenAI);
    expect(a).toBe(b);
    expect(a).toContain('## Instructions');
    expect(a).toContain('<placeholder id=');
  });

  it('renders XML-style placeholders for OpenAI', () => {
    const ir = baseIr();
    ir.goal = `X ${makeOmniabpToken('550e8400-e29b-41d4-a716-446655440000')}`;
    const s = compileAgentPromptToPlatform(ir, AgentPlatform.OpenAI);
    expect(s).toContain('<placeholder id="user_utterance_in"');
    expect(s).toContain('signature="backend:user_utterance_in"');
  });

  it('with expand off returns composed IR Markdown (raw tokens)', () => {
    const ir = baseIr();
    const s = compileAgentPromptToPlatform(ir, AgentPlatform.OpenAI, { expandPlaceholderTokens: false });
    expect(s).toBe(composeOmniaIrMarkdown(ir));
  });

  it('omits empty Examples section in IR markdown (expand off)', () => {
    const ir = baseIr();
    const s = compileAgentPromptToPlatform(ir, AgentPlatform.OpenAI, { expandPlaceholderTokens: false });
    expect(s).not.toContain('### Examples');
  });

  it('includes Examples when set (expand off)', () => {
    const ir = baseIr();
    ir.examples = 'User: Hi\nAssistant: Hello';
    const s = compileAgentPromptToPlatform(ir, AgentPlatform.OpenAI, { expandPlaceholderTokens: false });
    expect(s).toContain('### Examples');
    expect(s).toContain('User: Hi');
  });
});
