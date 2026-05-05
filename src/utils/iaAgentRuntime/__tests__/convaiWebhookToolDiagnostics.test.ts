import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractConvaiWebhookDiagnosticsFromConversationFragment } from '../convaiWebhookToolDiagnostics';

describe('extractConvaiWebhookDiagnosticsFromConversationFragment', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  });

  it('extracts webhook tool with method and url', () => {
    const frag = {
      agent: {
        prompt: {
          tools: [
            {
              type: 'webhook',
              name: 'getUser',
              description: 'x',
              api_schema: {
                url: 'https://api.example.com/v1',
                method: 'POST',
                request_headers: { 'X-A': '1' },
                request_body_schema: { type: 'object', properties: { id: { type: 'string' } } },
              },
            },
          ],
        },
      },
    };
    const out = extractConvaiWebhookDiagnosticsFromConversationFragment(frag);
    expect(out).toHaveLength(1);
    expect(out[0]!.toolName).toBe('getUser');
    expect(out[0]!.method).toBe('POST');
    expect(out[0]!.endpoint).toBe('https://api.example.com/v1');
    expect(out[0]!.unreachable).toBe(false);
  });

  it('flags localhost without tunnel as unreachable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => {
      if (k === 'omnia.devTunnel.portToPublicBaseJson') return '{}';
      return null;
    });
    const frag = {
      agent: {
        prompt: {
          tools: [
            {
              type: 'webhook',
              name: 't',
              api_schema: {
                url: 'http://localhost:3100/hook',
                method: 'GET',
                query_params_schema: { properties: { q: { type: 'string' } } },
              },
            },
          ],
        },
      },
    };
    const out = extractConvaiWebhookDiagnosticsFromConversationFragment(frag);
    expect(out[0]!.unreachable).toBe(true);
    expect(out[0]!.errorMessage).toMatch(/non raggiungibile/i);
  });
});
