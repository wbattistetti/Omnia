import { describe, expect, it } from 'vitest';
import {
  extractPromptToolIdsAndInline,
  parseConvaiInlineTool,
} from '../parseConvaiInlineTools';

describe('parseConvaiInlineTool', () => {
  it('parses webhook with api_schema url and method', () => {
    const row = parseConvaiInlineTool(
      {
        type: 'webhook',
        name: 'lookup_patient',
        description: 'Find patient',
        api_schema: { url: 'https://api.example/hook', method: 'POST' },
      },
      'fallback'
    );
    expect(row).toMatchObject({
      name: 'lookup_patient',
      kind: 'webhook',
      url: 'https://api.example/hook',
      httpMethod: 'POST',
      scope: 'agent',
      enabled: true,
    });
  });
});

describe('extractPromptToolIdsAndInline', () => {
  it('reads tool_ids and inline tools from conversation_config', () => {
    const { toolIds, inline } = extractPromptToolIdsAndInline({
      agent: {
        prompt: {
          tool_ids: ['tool_a', 'tool_b'],
          tools: [{ type: 'client', name: 'client_tool' }],
        },
      },
    });
    expect(toolIds).toEqual(['tool_a', 'tool_b']);
    expect(inline).toHaveLength(1);
    expect(inline[0]?.kind).toBe('client');
    expect(inline[0]?.name).toBe('client_tool');
  });
});
