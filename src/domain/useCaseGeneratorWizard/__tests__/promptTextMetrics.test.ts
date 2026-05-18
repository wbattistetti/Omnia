import { describe, expect, it } from 'vitest';
import {
  formatCompactCount,
  formatPromptMetricsLabel,
  measurePromptText,
} from '../promptTextMetrics';

describe('promptTextMetrics', () => {
  it('measurePromptText counts words and estimates tokens', () => {
    const m = measurePromptText('Ciao mondo esempio');
    expect(m.wordCount).toBe(3);
    expect(m.charCount).toBe(18);
    expect(m.estimatedTokens).toBeGreaterThan(0);
  });

  it('formatCompactCount abbreviates thousands', () => {
    expect(formatCompactCount(850)).toBe('850');
    expect(formatCompactCount(2400)).toBe('2.4k');
    expect(formatCompactCount(12000)).toBe('12k');
  });

  it('formatPromptMetricsLabel joins words and tokens', () => {
    const label = formatPromptMetricsLabel({
      charCount: 100,
      wordCount: 1200,
      estimatedTokens: 1500,
    });
    expect(label).toContain('parole');
    expect(label).toContain('tok');
  });
});
