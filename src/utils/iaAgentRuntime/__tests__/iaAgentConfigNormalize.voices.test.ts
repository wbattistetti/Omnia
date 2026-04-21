import { describe, expect, it } from 'vitest';
import { normalizeIAAgentConfig } from '../iaAgentConfigNormalize';

describe('normalizeIAAgentConfig voices', () => {
  it('parses voices array on elevenlabs', () => {
    const raw = {
      platform: 'elevenlabs',
      model: 'convai_default',
      voices: [
        { id: 'v1', role: 'primary' },
        { id: 'v2', role: 'secondary' },
      ],
      voice: { id: 'legacy', language: 'it-IT', settings: {} },
    };
    const c = normalizeIAAgentConfig(raw);
    expect(c.voices).toHaveLength(2);
    expect(c.voices?.[0]?.role).toBe('primary');
    expect(c.voices?.[1]?.id).toBe('v2');
    expect(c.voice?.id).toBe('v1');
    expect(c.voice?.language).toBe('it-IT');
  });

  it('fills primary from legacy voice id when voices missing', () => {
    const raw = {
      platform: 'elevenlabs',
      voice: { id: 'legacy-id', language: 'en-US', settings: {} },
    };
    const c = normalizeIAAgentConfig(raw);
    expect(c.voices?.[0]).toMatchObject({ id: 'legacy-id', role: 'primary' });
  });
});
