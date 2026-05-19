import { describe, expect, it } from 'vitest';
import { formatKbAnalyzeErrorForChat, KB_RETRY_REPLY_DEFAULT } from '../kbChatCopy';
import { isKbRetryReply } from '../kbChatHelpers';

describe('kb chat retry', () => {
  it('detects Riprova reply', () => {
    expect(isKbRetryReply('Riprova')).toBe(true);
    expect(isKbRetryReply(' riprova ')).toBe(true);
    expect(isKbRetryReply('Riprova ora')).toBe(false);
  });

  it('formats timeout for chat', () => {
    const msg = formatKbAnalyzeErrorForChat('OpenAIProvider request timeout after 60000ms');
    expect(msg).toMatch(/timeout/i);
    expect(msg).toMatch(/Riprova/);
  });

  it('exports retry default', () => {
    expect(KB_RETRY_REPLY_DEFAULT).toBe('Riprova');
  });
});
