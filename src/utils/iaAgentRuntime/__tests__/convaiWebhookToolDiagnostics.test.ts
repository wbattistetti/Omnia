import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  convaiWebhookDiagnosticsToTunnelCompileErrors,
  extractConvaiWebhookDiagnosticsFromConversationFragment,
} from '../convaiWebhookToolDiagnostics';
import type { FlowConvaiWebhookDiagnostic } from '@features/debugger/types/flowConvaiWebhookDiagnostic';

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

  it('flags localhost without explicit port as unreachable (external agents cannot use implicit port)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => {
      if (k === 'omnia.devTunnel.portToPublicBaseJson') return '{"3100":"https://pub.example"}';
      return null;
    });
    const frag = {
      agent: {
        prompt: {
          tools: [
            {
              type: 'webhook',
              name: 'noPort',
              api_schema: {
                url: 'http://localhost/api/hook',
                method: 'POST',
              },
            },
          ],
        },
      },
    };
    const out = extractConvaiWebhookDiagnosticsFromConversationFragment(frag);
    expect(out).toHaveLength(1);
    expect(out[0]!.unreachable).toBe(true);
    expect(out[0]!.errorMessage).toMatch(/senza porta esplicita/i);
  });
});

describe('convaiWebhookDiagnosticsToTunnelCompileErrors', () => {
  it('emits one compile error per AI Agent task with unreachable webhooks', () => {
    const diagnostics: FlowConvaiWebhookDiagnostic[] = [
      {
        kind: 'convai_webhook',
        toolName: 'bookfromagenda',
        sourceTaskId: 'task-agent-1',
        endpoint: 'http://localhost:3100/api/runtime/bookfromagenda',
        method: 'POST',
        headers: {},
        inputSchemaSummary: {},
        unreachable: true,
        errorMessage: 'test',
      },
    ];
    const errs = convaiWebhookDiagnosticsToTunnelCompileErrors(diagnostics);
    expect(errs).toHaveLength(1);
    expect(errs[0]!.taskId).toBe('task-agent-1');
    expect(errs[0]!.code).toBe('ConvaiWebhookLocalhostTunnelMissing');
    expect(errs[0]!.severity).toBe('Error');
    expect(errs[0]!.message).toMatch(/hanno bisogno di tunnel/i);
    expect(errs[0]!.message).toContain('http://localhost:3100/api/runtime/bookfromagenda');
    expect(errs[0]!.convaiWebhookTunnelUrls).toEqual([
      'http://localhost:3100/api/runtime/bookfromagenda',
    ]);
  });

  it('dedupes multiple unreachable tools on same task into one error', () => {
    const diagnostics: FlowConvaiWebhookDiagnostic[] = [
      {
        kind: 'convai_webhook',
        toolName: 'a',
        sourceTaskId: 'tid',
        endpoint: 'http://localhost:3100/x',
        method: 'POST',
        headers: {},
        inputSchemaSummary: {},
        unreachable: true,
      },
      {
        kind: 'convai_webhook',
        toolName: 'b',
        sourceTaskId: 'tid',
        endpoint: 'http://localhost:3100/y',
        method: 'POST',
        headers: {},
        inputSchemaSummary: {},
        unreachable: true,
      },
    ];
    const errs = convaiWebhookDiagnosticsToTunnelCompileErrors(diagnostics);
    expect(errs).toHaveLength(1);
    expect(errs[0]!.message).toContain('http://localhost:3100/x');
    expect(errs[0]!.message).toContain('http://localhost:3100/y');
  });

  it('returns empty when no unreachable diagnostics', () => {
    const diagnostics: FlowConvaiWebhookDiagnostic[] = [
      {
        kind: 'convai_webhook',
        toolName: 'x',
        sourceTaskId: 'tid',
        endpoint: 'https://api.example.com/hook',
        method: 'POST',
        headers: {},
        inputSchemaSummary: {},
        unreachable: false,
      },
    ];
    expect(convaiWebhookDiagnosticsToTunnelCompileErrors(diagnostics)).toEqual([]);
  });
});
