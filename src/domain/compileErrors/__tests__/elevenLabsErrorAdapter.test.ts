import { describe, expect, it } from 'vitest';
import { elevenLabsErrorAdapter } from '../elevenLabsErrorAdapter';
import { normalizeProviderError } from '../normalizeProviderError';
import { inferFixAction } from '../fixActions';

describe('elevenLabsErrorAdapter', () => {
  it('recognizes Omnia proxy Error with embedded ElevenLabs JSON detail', () => {
    const detail = JSON.stringify({
      detail: [{ type: 'value_error', msg: 'Non-english Agents must use turbo or flash v2_5.' }],
    });
    const err = new Error(`ElevenLabs agents/create failed. — ${detail}`);
    expect(elevenLabsErrorAdapter.canHandle(err)).toBe(true);
    const n = elevenLabsErrorAdapter.normalize(err);
    expect(n.provider).toBe('elevenlabs');
    expect(n.message).toContain('Non-english Agents');
    expect(inferFixAction(n)).toBe('open_elevenlabs_model');
  });

  it('normalizeProviderError selects ElevenLabs adapter', () => {
    const err = new Error('ElevenLabs agents/create failed. — {}');
    const n = normalizeProviderError(err);
    expect(n).not.toBeNull();
    expect(n!.provider).toBe('elevenlabs');
  });

  it('inferFixAction opens LLM panel for Input should be enum', () => {
    const n = {
      provider: 'elevenlabs' as const,
      code: 'x',
      message: `ElevenLabs agents/create failed. — Input should be 'gpt-4o-mini'`,
    };
    expect(inferFixAction(n)).toBe('open_elevenlabs_model');
  });
});
