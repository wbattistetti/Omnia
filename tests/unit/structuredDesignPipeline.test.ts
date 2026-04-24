// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  generatePlatformPrompt,
  validateStructuredDesign,
  normalizePhase1StructuredDesign,
  sectionTextForCompile,
} = require('../../backend/services/StructuredDesignPipelineService.js') as {
  generatePlatformPrompt: (
    platform: string,
    structuredDesign: object,
    options?: Record<string, unknown>
  ) => Promise<{ platform: string; system_prompt: string }>;
  validateStructuredDesign: (raw: unknown) => object;
  normalizePhase1StructuredDesign: (raw: unknown) => Record<string, unknown>;
  sectionTextForCompile: (v: unknown) => string;
};

const sampleDesign = {
  goal: 'Help the user pick a time slot.',
  operational_sequence: 'Ask for date, then offer slots.',
  context: 'missing',
  constraints: { must: 'Stay polite.', must_not: 'missing' },
  personality: 'Calm assistant.',
  tone: 'Brief.',
};

describe('StructuredDesignPipelineService', () => {
  it('validateStructuredDesign accepts a valid payload', () => {
    const v = validateStructuredDesign(sampleDesign);
    expect(v.goal).toBe(sampleDesign.goal);
    expect(v.constraints.must_not).toBe('missing');
  });

  it('validateStructuredDesign rejects invalid shapes', () => {
    expect(() => validateStructuredDesign(null)).toThrow();
    expect(() => validateStructuredDesign({ goal: 1 })).toThrow();
    expect(() =>
      validateStructuredDesign({
        ...sampleDesign,
        constraints: 'bad',
      })
    ).toThrow();
  });

  it('normalizePhase1StructuredDesign + validate accepts null constraints.must', () => {
    const raw = {
      ...sampleDesign,
      constraints: { must: null, must_not: 'Do not leak PII.' },
    };
    const n = normalizePhase1StructuredDesign(raw);
    const v = validateStructuredDesign(n) as { constraints: { must: string; must_not: string } };
    expect(v.constraints.must).toBe('missing');
    expect(v.constraints.must_not).toBe('Do not leak PII.');
  });

  it('normalizePhase1StructuredDesign maps mustNot alias', () => {
    const raw = {
      ...sampleDesign,
      constraints: { must: 'Be helpful.', mustNot: 'No spam.' },
    };
    const n = normalizePhase1StructuredDesign(raw);
    const v = validateStructuredDesign(n) as { constraints: { must: string; must_not: string } };
    expect(v.constraints.must).toBe('Be helpful.');
    expect(v.constraints.must_not).toBe('No spam.');
  });

  it('normalizePhase1StructuredDesign replaces non-object constraints', () => {
    const raw = {
      ...sampleDesign,
      constraints: ['not', 'an', 'object'],
    };
    const n = normalizePhase1StructuredDesign(raw);
    const v = validateStructuredDesign(n) as { constraints: { must: string; must_not: string } };
    expect(v.constraints.must).toBe('missing');
    expect(v.constraints.must_not).toBe('missing');
  });

  it('sectionTextForCompile drops missing only', () => {
    expect(sectionTextForCompile('missing')).toBe('');
    expect(sectionTextForCompile('ambiguous')).toBe('ambiguous');
  });

  it('mode deterministic (default) matches explicit mode deterministic', async () => {
    const defaults = await generatePlatformPrompt('openai', sampleDesign);
    const explicit = await generatePlatformPrompt('openai', sampleDesign, { mode: 'deterministic' });
    expect(explicit).toEqual(defaults);
  });

  it('generatePlatformPrompt elevenlabs is compact single-block style', async () => {
    const { platform, system_prompt } = await generatePlatformPrompt('ElevenLabs', sampleDesign);
    expect(platform).toBe('elevenlabs');
    expect(system_prompt).toContain('Goal:');
    expect(system_prompt).toContain('Must:');
    expect(system_prompt).not.toContain('Must not:');
  });

  it('generatePlatformPrompt anthropic maps principles and instructions', async () => {
    const { platform, system_prompt } = await generatePlatformPrompt('anthropic', sampleDesign);
    expect(platform).toBe('anthropic');
    expect(system_prompt).toContain('Principles:');
    expect(system_prompt).toContain('Instructions:');
    expect(system_prompt).toContain('Behavior:');
  });

  it('generatePlatformPrompt openai includes labeled sections', async () => {
    const { platform, system_prompt } = await generatePlatformPrompt('openai', sampleDesign);
    expect(platform).toBe('openai');
    expect(system_prompt).toContain('Role and objective:');
    expect(system_prompt).toContain('Operational sequence:');
  });

  it('generatePlatformPrompt unknown platform uses generic labels', async () => {
    const { platform, system_prompt } = await generatePlatformPrompt('custom_vendor', sampleDesign);
    expect(platform).toBe('custom_vendor');
    expect(system_prompt).toContain('goal:');
  });

  it('generatePlatformPrompt rejects llm_compiled', async () => {
    await expect(
      generatePlatformPrompt('openai', sampleDesign, { mode: 'llm_compiled' })
    ).rejects.toThrow(/llm_compiled has been removed/);
  });
});
