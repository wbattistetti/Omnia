/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

const {
  isLikelyTruncatedJson,
  extractAndParseModelJson,
  buildCompactJsonRetryDirective,
  buildStrictJsonRetryDirective,
  shouldRetryModelJsonParse,
} = require('../modelJsonResponse.js');

describe('isLikelyTruncatedJson', () => {
  it('returns false for valid JSON', () => {
    expect(isLikelyTruncatedJson('{"a":[1,2]}')).toBe(false);
  });

  it('returns true when a string is left open', () => {
    expect(isLikelyTruncatedJson('{"logical_steps":[{"id":"x","description":"cut')).toBe(true);
  });

  it('returns true when brackets are unbalanced', () => {
    expect(isLikelyTruncatedJson('{"logical_steps":[{"id":"a"}')).toBe(true);
  });
});

describe('extractAndParseModelJson', () => {
  it('parses a fenced JSON payload', () => {
    const response = {
      choices: [
        {
          finish_reason: 'stop',
          message: { content: '```json\n{"ok":true}\n```' },
        },
      ],
    };
    const result = extractAndParseModelJson(response);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parsed).toEqual({ ok: true });
  });

  it('flags truncation on finish_reason length', () => {
    const response = {
      choices: [
        {
          finish_reason: 'length',
          message: { content: '{"logical_steps":[{"id":"a","description":"x"}' },
        },
      ],
    };
    const result = extractAndParseModelJson(response);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.truncated).toBe(true);
  });
});

describe('buildCompactJsonRetryDirective', () => {
  it('includes the scenario band', () => {
    const text = buildCompactJsonRetryDirective(5, 8);
    expect(text).toMatch(/5.*8/);
    expect(text).toMatch(/OUTPUT_RETRY/);
  });
});

describe('buildStrictJsonRetryDirective', () => {
  it('asks for valid JSON only', () => {
    expect(buildStrictJsonRetryDirective()).toMatch(/valid JSON/i);
  });
});

describe('shouldRetryModelJsonParse', () => {
  it('allows two retries in chunked mode (3 attempts)', () => {
    expect(shouldRetryModelJsonParse(0, 3, true)).toBe(true);
    expect(shouldRetryModelJsonParse(1, 3, true)).toBe(true);
    expect(shouldRetryModelJsonParse(2, 3, true)).toBe(false);
  });
});
