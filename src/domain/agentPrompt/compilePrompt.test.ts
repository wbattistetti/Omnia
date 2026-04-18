import { describe, expect, it } from 'vitest';
import { compilePromptFromStructuredSections } from './compilePrompt';
import { AgentPlatform } from './promptIr';
import type { AgentStructuredSections } from './types';

function minimalIr(): AgentStructuredSections {
  return {
    goal: 'G',
    operational_sequence: '',
    context: '',
    constraints: '',
    personality: '',
    tone: '',
    examples: '',
    backendPlaceholders: [],
  };
}

describe('compilePromptFromStructuredSections', () => {
  it('returns discriminated output per platform', () => {
    const ir = minimalIr();
    const openai = compilePromptFromStructuredSections(ir, AgentPlatform.OpenAI);
    expect(openai.platform).toBe(AgentPlatform.OpenAI);
    const eleven = compilePromptFromStructuredSections(ir, AgentPlatform.ElevenLabs);
    expect(eleven.platform).toBe(AgentPlatform.ElevenLabs);
    if (eleven.platform === AgentPlatform.ElevenLabs) {
      expect(eleven.prompt.length).toBeGreaterThan(0);
    }
  });
});
