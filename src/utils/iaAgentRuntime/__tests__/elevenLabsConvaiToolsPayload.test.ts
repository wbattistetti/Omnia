/**
 * Formato tool ElevenLabs (`webhook` / `client`) da Backend Call e tool manuali.
 */

import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { buildElevenLabsConvaiPromptTools } from '../elevenLabsConvaiToolsPayload';

function backendTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    type: TaskType.BackendCall,
    label: 'api',
    backendToolDescription: 'desc',
    endpoint: { url: 'https://api.example.com/slots', method: 'POST', headers: {} },
    inputs: [],
    outputs: [],
    ...overrides,
  } as Task;
}

describe('buildElevenLabsConvaiPromptTools', () => {
  it('emits webhook tools with api_schema (not OpenAI function)', () => {
    const cfg = {
      platform: 'elevenlabs',
      convaiBackendToolTaskIds: ['bk1'],
      tools: [],
    } as IAAgentConfig;

    const tools = buildElevenLabsConvaiPromptTools(cfg, (id) =>
      id === 'bk1'
        ? backendTask({
            id: 'bk1',
            label: 'slots',
            backendToolDescription: 'Lista slot.',
            endpoint: {
              url: 'https://api.example.com/v1/slots',
              method: 'POST',
              headers: { 'X-Test': '1' },
            },
            inputs: [{ internalName: 'a', apiParam: 'n', fieldDescription: 'N' }],
          })
        : null
    );

    expect(tools).toHaveLength(1);
    expect(tools[0].type).toBe('webhook');
    expect(tools[0].name).toBeTruthy();
    expect(tools[0]).not.toHaveProperty('function');
    const api = tools[0].api_schema as Record<string, unknown>;
    expect(api.url).toBe('https://api.example.com/v1/slots');
    expect(api.method).toBe('POST');
    expect(api.request_headers).toEqual({ 'X-Test': '1' });
    expect(api.request_body_schema).toEqual(expect.objectContaining({ type: 'object' }));
  });

  it('uses query_params_schema for GET backends', () => {
    const cfg = {
      platform: 'elevenlabs',
      convaiBackendToolTaskIds: ['bk2'],
      tools: [],
    } as IAAgentConfig;

    const tools = buildElevenLabsConvaiPromptTools(cfg, (id) =>
      id === 'bk2'
        ? backendTask({
            id: 'bk2',
            label: 'get_x',
            backendToolDescription: 'Get.',
            endpoint: { url: 'https://api.example.com/x', method: 'GET', headers: {} },
            inputs: [],
          })
        : null
    );

    const api = tools[0].api_schema as Record<string, unknown>;
    expect(api.method).toBe('GET');
    const qps = api.query_params_schema as Record<string, unknown>;
    expect(qps).toBeDefined();
    expect(qps).not.toHaveProperty('type');
    expect(qps.properties).toEqual(expect.any(Object));
    expect(api.request_body_schema).toBeUndefined();
  });

  it('emits client tools for cfg.tools entries', () => {
    const cfg = {
      platform: 'elevenlabs',
      tools: [
        {
          name: 'ui_refresh',
          description: 'Aggiorna UI.',
          inputSchema: { type: 'object', properties: { x: { type: 'string' } } },
        },
      ],
    } as unknown as IAAgentConfig;

    const tools = buildElevenLabsConvaiPromptTools(cfg, () => null);
    expect(tools).toHaveLength(1);
    expect(tools[0].type).toBe('client');
    expect((tools[0].parameters as Record<string, unknown>).type).toBe('object');
  });
});
