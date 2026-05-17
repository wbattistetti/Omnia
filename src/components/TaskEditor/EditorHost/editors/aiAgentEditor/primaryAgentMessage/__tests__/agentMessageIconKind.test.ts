import { describe, expect, it } from 'vitest';
import {
  hasStyleVariationsInMessage,
  resolveAgentMessageIconKind,
} from '../agentMessageIconKind';

describe('resolveAgentMessageIconKind', () => {
  it('returns single when no parametric and no style variations', () => {
    expect(
      resolveAgentMessageIconKind({
        parametricEnabled: false,
        hasStyleVariations: false,
      })
    ).toBe('single');
  });

  it('returns parametric when enabled even with style variations', () => {
    expect(
      resolveAgentMessageIconKind({
        parametricEnabled: true,
        hasStyleVariations: true,
      })
    ).toBe('parametric');
  });

  it('returns style when tokens or examples exist and not parametric', () => {
    expect(
      resolveAgentMessageIconKind({
        parametricEnabled: false,
        hasStyleVariations: true,
      })
    ).toBe('style');
  });
});

describe('hasStyleVariationsInMessage', () => {
  it('is true with style tokens in text', () => {
    expect(
      hasStyleVariationsInMessage({ hasStyleTokens: true, styleExampleCount: 0 })
    ).toBe(true);
  });

  it('is true with persisted examples only', () => {
    expect(
      hasStyleVariationsInMessage({ hasStyleTokens: false, styleExampleCount: 2 })
    ).toBe(true);
  });

  it('is false for plain canonical message', () => {
    expect(
      hasStyleVariationsInMessage({ hasStyleTokens: false, styleExampleCount: 0 })
    ).toBe(false);
  });
});
