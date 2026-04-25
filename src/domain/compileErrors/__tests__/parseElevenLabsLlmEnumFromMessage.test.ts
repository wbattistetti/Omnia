import { describe, expect, it } from 'vitest';
import {
  extractLlmEnumQuotedIdsFromMessage,
  messageLooksLikeElevenLabsLlmEnumValidation,
} from '../parseElevenLabsLlmEnumFromMessage';

describe('extractLlmEnumQuotedIdsFromMessage', () => {
  it('parses long ElevenLabs enum line', () => {
    const msg =
      `Input should be 'gpt-4o-mini', 'gpt-4o', 'gemini-2.0-flash', 'eleven_flash_v2_5' [ElevenLabs API base: https://api.eu.residency.elevenlabs.io]`;
    const ids = extractLlmEnumQuotedIdsFromMessage(msg);
    expect(ids).toContain('gpt-4o-mini');
    expect(ids).toContain('gemini-2.0-flash');
    expect(ids).toContain('eleven_flash_v2_5');
    expect(ids.length).toBe(4);
  });

  it('returns empty when marker missing', () => {
    expect(extractLlmEnumQuotedIdsFromMessage('turbo or flash only')).toEqual([]);
  });

  it('dedupes repeated ids', () => {
    const msg = "Input should be 'gpt-4o', 'gpt-4o'";
    expect(extractLlmEnumQuotedIdsFromMessage(msg)).toEqual(['gpt-4o']);
  });
});

describe('messageLooksLikeElevenLabsLlmEnumValidation', () => {
  it('matches agents/create style blob', () => {
    const blob = `ElevenLabs agents/create failed. — {"detail":[{"loc":["llm"],"msg":"Input should be 'gpt-4o'"}]}`;
    expect(messageLooksLikeElevenLabsLlmEnumValidation(blob)).toBe(true);
  });

  it('rejects random text with Input should be but no ids', () => {
    expect(messageLooksLikeElevenLabsLlmEnumValidation('Input should be valid')).toBe(false);
  });
});
