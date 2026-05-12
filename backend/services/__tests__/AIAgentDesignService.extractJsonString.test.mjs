// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Unit tests for `extractJsonString` and `coerceModelContentToText` in AIAgentDesignService.
 *
 * These tests pin down the contract used by every AI use-case / conversation / tokenization
 * service: the helper must accept both plain strings (legacy chat completions) AND content-parts
 * arrays (modern reasoning models). Failing those assertions means downstream services will
 * surface "Empty model response" even when the LLM did return text.
 *
 * Run: `npx vitest run backend/services/__tests__/AIAgentDesignService.extractJsonString.test.mjs`
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractJsonString, coerceModelContentToText } = require('../AIAgentDesignService.js');

describe('coerceModelContentToText', () => {
  it('returns the same string when given a plain string', () => {
    expect(coerceModelContentToText('hello')).toBe('hello');
  });

  it('joins text parts from a content-parts array', () => {
    expect(
      coerceModelContentToText([
        { type: 'text', text: 'foo' },
        { type: 'text', text: 'bar' },
      ])
    ).toBe('foobar');
  });

  it('falls back to part.content when only that field carries the text', () => {
    expect(coerceModelContentToText([{ type: 'text', content: 'hi' }])).toBe('hi');
  });

  it('returns "" for null, undefined or other non-textual shapes', () => {
    expect(coerceModelContentToText(null)).toBe('');
    expect(coerceModelContentToText(undefined)).toBe('');
    expect(coerceModelContentToText(42)).toBe('');
    expect(coerceModelContentToText({ text: 'nope' })).toBe('');
  });

  it('skips parts that are not text and continues with the others', () => {
    expect(
      coerceModelContentToText([
        { type: 'image', url: 'x' },
        { type: 'text', text: 'kept' },
      ])
    ).toBe('kept');
  });
});

describe('extractJsonString', () => {
  it('returns trimmed string content as-is', () => {
    expect(extractJsonString('  {"a":1}  ')).toBe('{"a":1}');
  });

  it('strips ```json ... ``` markdown fences', () => {
    const fenced = '```json\n{"a":1}\n```';
    expect(extractJsonString(fenced)).toBe('{"a":1}');
  });

  it('strips bare ``` ... ``` markdown fences', () => {
    const fenced = '```\n{"a":1}\n```';
    expect(extractJsonString(fenced)).toBe('{"a":1}');
  });

  it('accepts a content-parts array (modern reasoning models)', () => {
    const parts = [
      { type: 'text', text: '{"use_cases":' },
      { type: 'text', text: '[]}' },
    ];
    expect(extractJsonString(parts)).toBe('{"use_cases":[]}');
  });

  it('accepts a content-parts array containing a fenced JSON block', () => {
    const parts = [{ type: 'text', text: '```json\n{"a":1}\n```' }];
    expect(extractJsonString(parts)).toBe('{"a":1}');
  });

  it('throws "Empty model response" when raw is null, undefined, "" or only whitespace', () => {
    expect(() => extractJsonString(null)).toThrow(/Empty model response/);
    expect(() => extractJsonString(undefined)).toThrow(/Empty model response/);
    expect(() => extractJsonString('')).toThrow(/Empty model response/);
    expect(() => extractJsonString('   \n  ')).toThrow(/Empty model response/);
  });

  it('throws "Empty model response" when an array has no usable text parts', () => {
    expect(() => extractJsonString([{ type: 'image', url: 'x' }])).toThrow(/Empty model response/);
    expect(() => extractJsonString([{ type: 'text', text: '' }])).toThrow(/Empty model response/);
  });

  it('throws a distinct diagnostic when raw is neither string nor array', () => {
    expect(() => extractJsonString(123)).toThrow(/not textual.*number/);
    expect(() => extractJsonString({ text: 'x' })).toThrow(/not textual.*object/);
  });

  it('embeds the raw-content shape in the empty-response error for diagnosis', () => {
    expect(() => extractJsonString(null)).toThrow(/Empty model response \(raw=null\)/);
    expect(() => extractJsonString(undefined)).toThrow(/Empty model response \(raw=undefined\)/);
    expect(() => extractJsonString('')).toThrow(/Empty model response \(raw=string\(len=0/);
    expect(() => extractJsonString([{ type: 'text', text: '' }])).toThrow(
      /Empty model response \(raw=array\(parts=1, types=\[text\]\)/
    );
  });
});
