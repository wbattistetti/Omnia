// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Unit tests for the cost calculator. Targets the pure variant `computeCostWithDeps` so we don't
 * need to mock any IO. Run: `npx vitest run backend/services/aiCost/__tests__`.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeUsage, computeCostWithDeps } = require('../AICostCalculator.js');

describe('normalizeUsage', () => {
  it('reads OpenAI / Groq token names', () => {
    expect(normalizeUsage('openai', { prompt_tokens: 100, completion_tokens: 50 })).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    expect(
      normalizeUsage('groq', { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 })
    ).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
  });

  it('reads Anthropic token names', () => {
    expect(normalizeUsage('anthropic', { input_tokens: 200, output_tokens: 80 })).toEqual({
      inputTokens: 200,
      outputTokens: 80,
      totalTokens: 280,
    });
  });

  it('reads Google Gemini token names', () => {
    expect(
      normalizeUsage('google', {
        promptTokenCount: 30,
        candidatesTokenCount: 20,
        totalTokenCount: 55,
      })
    ).toEqual({ inputTokens: 30, outputTokens: 20, totalTokens: 55 });
  });

  it('returns zeros when usage is missing or malformed', () => {
    expect(normalizeUsage('openai', null)).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    expect(normalizeUsage('openai', {})).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });
});

describe('computeCostWithDeps', () => {
  it('multiplies tokens x per-token rate and applies the FX rate when available', () => {
    const result = computeCostWithDeps({
      providerId: 'openai',
      modelId: 'gpt-5',
      response: { usage: { prompt_tokens: 1000, completion_tokens: 500 } },
      pricingEntry: { inputUsdPer1M: 1.25, outputUsdPer1M: 10 },
      usdToEur: 0.92,
    });
    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.costUsd).toBeCloseTo((1000 * 1.25 + 500 * 10) / 1_000_000, 12);
    expect(result.costEur).toBeCloseTo(result.costUsd * 0.92, 12);
    expect(result.pricingFound).toBe(true);
    expect(result.usdToEur).toBe(0.92);
  });

  it('returns costUsd=0 (free / unknown model policy) when pricing is missing, without throwing', () => {
    const result = computeCostWithDeps({
      providerId: 'groq',
      modelId: 'brand-new-model',
      response: { usage: { prompt_tokens: 1000, completion_tokens: 500 } },
      pricingEntry: null,
      usdToEur: 0.92,
    });
    expect(result.costUsd).toBe(0);
    expect(result.costEur).toBe(0);
    expect(result.pricingFound).toBe(false);
  });

  it('omits costEur when no FX rate is cached yet', () => {
    const result = computeCostWithDeps({
      providerId: 'openai',
      modelId: 'gpt-5',
      response: { usage: { prompt_tokens: 1000, completion_tokens: 0 } },
      pricingEntry: { inputUsdPer1M: 1, outputUsdPer1M: 1 },
      usdToEur: null,
    });
    expect(result.costUsd).toBeCloseTo(0.001, 12);
    expect(result.costEur).toBeNull();
  });

  it('reads usageMetadata for Google responses', () => {
    const result = computeCostWithDeps({
      providerId: 'google',
      modelId: 'gemini-2.5-pro',
      response: {
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 },
      },
      pricingEntry: { inputUsdPer1M: 1.25, outputUsdPer1M: 5 },
      usdToEur: 0.9,
    });
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(200);
    expect(result.costUsd).toBeCloseTo((100 * 1.25 + 200 * 5) / 1_000_000, 12);
  });

  it('still sets costEur=0 (not null) when there is FX but no pricing, so UI renders symmetric currencies', () => {
    const result = computeCostWithDeps({
      providerId: 'openai',
      modelId: 'unknown-model',
      response: { usage: { prompt_tokens: 100, completion_tokens: 100 } },
      pricingEntry: null,
      usdToEur: 0.92,
    });
    expect(result.costUsd).toBe(0);
    expect(result.costEur).toBe(0);
  });
});
