import { describe, it, expect } from 'vitest';
import { getVisibleFields, getDefaultConfig } from '../platformHelpers';

describe('getVisibleFields', () => {
  it('enables OpenAI tuning keys', () => {
    const v = getVisibleFields('openai');
    expect(v.model).toBe(true);
    expect(v.top_p).toBe(true);
    expect(v.seed).toBe(true);
    expect(v.voice).toBe(false);
  });

  it('enables Anthropic reasoning and stop_sequences', () => {
    const v = getVisibleFields('anthropic');
    expect(v.reasoning).toBe(true);
    expect(v.stop_sequences).toBe(true);
  });

  it('enables Gemini safety and top_k', () => {
    const v = getVisibleFields('google');
    expect(v.safety_settings).toBe(true);
    expect(v.top_k).toBe(true);
  });

  it('enables ElevenLabs voice and workflow', () => {
    const v = getVisibleFields('elevenlabs');
    expect(v.model).toBe(false);
    expect(v.voice).toBe(true);
    expect(v.workflow).toBe(true);
    expect(v.llm_model).toBe(true);
  });
});

describe('getDefaultConfig', () => {
  it('returns distinct models per platform', () => {
    expect(getDefaultConfig('openai').platform).toBe('openai');
    expect(getDefaultConfig('anthropic').model).toContain('claude');
    expect(getDefaultConfig('google').model).toContain('gemini');
    expect(getDefaultConfig('elevenlabs').voice?.language).toBe('en');
  });

  it('includes advanced defaults for OpenAI', () => {
    const c = getDefaultConfig('openai');
    expect(c.advanced?.top_p).toBeDefined();
  });
});
