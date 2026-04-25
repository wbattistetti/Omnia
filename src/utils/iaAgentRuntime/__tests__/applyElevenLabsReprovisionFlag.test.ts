import { describe, expect, it } from 'vitest';
import { withElevenLabsReprovisionAfterTtsChange } from '../applyElevenLabsReprovisionFlag';
import { getDefaultConfig } from '../platformHelpers';

describe('withElevenLabsReprovisionAfterTtsChange', () => {
  it('sets elevenLabsNeedsReprovision when TTS changes and ConvAI id exists (hydrated)', () => {
    const prev = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'agent_old', ttsModel: '' };
    const next = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'agent_old', ttsModel: 'eleven_turbo_v2_5' };
    const out = withElevenLabsReprovisionAfterTtsChange(prev, next, true);
    expect(out.elevenLabsNeedsReprovision).toBe(true);
    expect(out.ttsModel).toBe('eleven_turbo_v2_5');
  });

  it('clears flag when platform is not elevenlabs', () => {
    const prev = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'a', ttsModel: 'x' };
    const next = { ...getDefaultConfig('openai') };
    const out = withElevenLabsReprovisionAfterTtsChange(prev, next, true);
    expect(out.elevenLabsNeedsReprovision).toBe(false);
  });

  it('does not set flag before hydration', () => {
    const prev = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'agent_old', ttsModel: '' };
    const next = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'agent_old', ttsModel: 'eleven_flash_v2' };
    const out = withElevenLabsReprovisionAfterTtsChange(prev, next, false);
    expect(out.elevenLabsNeedsReprovision).toBe(false);
  });

  it('sets flag when systemPrompt changes and ConvAI id exists (hydrated)', () => {
    const prev = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'agent_old', systemPrompt: 'A' };
    const next = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'agent_old', systemPrompt: 'B' };
    const out = withElevenLabsReprovisionAfterTtsChange(prev, next, true);
    expect(out.elevenLabsNeedsReprovision).toBe(true);
  });
});
