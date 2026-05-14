// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { AI_CALL_PURPOSE, describeAiCallPurpose } from '../purposes';

describe('describeAiCallPurpose', () => {
  it('translates a known purpose id to its Italian label', () => {
    expect(describeAiCallPurpose(AI_CALL_PURPOSE.CONVERSATION_POSITIVE)).toBe(
      'Conversazione con chiusura positiva'
    );
    expect(describeAiCallPurpose(AI_CALL_PURPOSE.USE_CASE_BUNDLE_INITIAL)).toBe(
      'Generazione iniziale use case bundle'
    );
  });

  it('returns the raw id verbatim when the purpose is unknown (forensic visibility, not a guess)', () => {
    expect(describeAiCallPurpose('SOME_FUTURE_PURPOSE_ID')).toBe('SOME_FUTURE_PURPOSE_ID');
  });

  it('returns a clear fallback when no purpose is provided so legacy log entries stay readable', () => {
    expect(describeAiCallPurpose(null)).toBe('Chiamata IA non categorizzata');
    expect(describeAiCallPurpose(undefined)).toBe('Chiamata IA non categorizzata');
    expect(describeAiCallPurpose('')).toBe('Chiamata IA non categorizzata');
  });

  it('keeps purpose ids stable to avoid breaking the backend log key-value contract', () => {
    expect(AI_CALL_PURPOSE.CONVERSATION_POSITIVE).toBe('CONVERSATION_POSITIVE');
    expect(AI_CALL_PURPOSE.CONVERSATION_NEGATIVE).toBe('CONVERSATION_NEGATIVE');
    expect(AI_CALL_PURPOSE.CONVERSATION_SUGGESTED).toBe('CONVERSATION_SUGGESTED');
    expect(AI_CALL_PURPOSE.CONVERSATION_PROOFREAD).toBe('CONVERSATION_PROOFREAD');
    expect(AI_CALL_PURPOSE.USE_CASE_BUNDLE_INITIAL).toBe('USE_CASE_BUNDLE_INITIAL');
    expect(AI_CALL_PURPOSE.USE_CASE_GENERATE_MORE).toBe('USE_CASE_GENERATE_MORE');
    expect(AI_CALL_PURPOSE.USE_CASE_TOKENIZE).toBe('USE_CASE_TOKENIZE');
    expect(AI_CALL_PURPOSE.USE_CASE_GENERALIZE_META).toBe('USE_CASE_GENERALIZE_META');
  });
});
