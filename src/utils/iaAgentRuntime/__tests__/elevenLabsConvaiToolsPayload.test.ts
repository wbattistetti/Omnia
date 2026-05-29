/**
 * Formato tool ElevenLabs (`webhook` / `client`) da Backend Call e tool manuali.
 */

import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import {
  buildConvaiWebhookToolFromBackendTask,
  buildElevenLabsConvaiPromptTools,
} from '../elevenLabsConvaiToolsPayload';

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
    expect(api.request_body_schema).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: {
          n: expect.objectContaining({
            description: 'N',
            type: 'string',
          }),
        },
      })
    );
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

  it('maps GET query param properties to description + type (ElevenLabs query_params_schema)', () => {
    const cfg = {
      platform: 'elevenlabs',
      convaiBackendToolTaskIds: ['bk2b'],
      tools: [],
    } as IAAgentConfig;

    const tools = buildElevenLabsConvaiPromptTools(cfg, (id) =>
      id === 'bk2b'
        ? backendTask({
            id: 'bk2b',
            label: 'get_with_query',
            backendToolDescription: 'Get with params.',
            endpoint: { url: 'https://api.example.com/x', method: 'GET', headers: {} },
            inputs: [{ internalName: 'queryConstraints', apiParam: 'queryConstraints' }],
          })
        : null
    );

    const api = tools[0].api_schema as Record<string, unknown>;
    expect(api.method).toBe('GET');
    const qps = api.query_params_schema as Record<string, unknown>;
    const props = qps.properties as Record<string, unknown>;
    expect(props.queryConstraints).toEqual(
      expect.objectContaining({
        description: 'Parametro queryConstraints',
        type: 'string',
      })
    );
    expect(api.request_body_schema).toBeUndefined();
  });

  it('merges BookFromAgenda v4.5 scope fields into request_body_schema for bookfromagenda URL', () => {
    const cfg = {
      platform: 'elevenlabs',
      convaiBackendToolTaskIds: ['bfa'],
      tools: [],
    } as IAAgentConfig;

    const tools = buildElevenLabsConvaiPromptTools(cfg, (id) =>
      id === 'bfa'
        ? backendTask({
            id: 'bfa',
            label: 'book_agenda',
            backendToolDescription: 'Slot da agenda.',
            endpoint: {
              url: 'http://localhost:3100/api/runtime/bookfromagenda',
              method: 'POST',
              headers: {},
            },
            inputs: [{ internalName: 'qc', apiParam: 'queryConstraints' }],
          })
        : null
    );

    expect(tools).toHaveLength(1);
    const api = tools[0].api_schema as Record<string, unknown>;
    const body = api.request_body_schema as Record<string, unknown>;
    const props = body.properties as Record<string, unknown>;
    expect(props.conversationId).toEqual(
      expect.objectContaining({ type: 'string', description: expect.any(String) })
    );
    expect(props.forceRefresh).toEqual(
      expect.objectContaining({ type: 'boolean', description: expect.any(String) })
    );
    expect(body.required).toEqual(
      expect.arrayContaining(['projectId', 'conversationId', 'agenda.url', 'agenda.type'])
    );
  });

  it('preserves enum constraints in ElevenLabs body schema (fixed infra literals)', () => {
    const cfg = {
      platform: 'elevenlabs',
      convaiBackendToolTaskIds: ['bfa'],
      tools: [],
    } as IAAgentConfig;
    const tools = buildElevenLabsConvaiPromptTools(cfg, (id) =>
      id === 'bfa'
        ? backendTask({
            id: 'bfa',
            label: 'book_agenda',
            backendToolDescription: 'Slot da agenda.',
            endpoint: {
              url: 'http://localhost:3100/api/runtime/bookfromagenda',
              method: 'POST',
              headers: {},
            },
            inputs: [
              { internalName: 'u', apiParam: 'agenda.url', variable: 'https://real.feed/agenda' },
              { internalName: 't', apiParam: 'agenda.type', variable: 'Omnia' },
              { internalName: 'p', apiParam: 'projectId', variable: 'project_static' },
              { internalName: 'fr', apiParam: 'forceRefresh', variable: 'true' },
            ],
          })
        : null
    );
    const api = tools[0].api_schema as Record<string, unknown>;
    const body = api.request_body_schema as Record<string, unknown>;
    const props = body.properties as Record<string, Record<string, unknown>>;
    expect(props['agenda.url']?.enum).toEqual(['https://real.feed/agenda']);
    expect(props['agenda.type']?.enum).toEqual(['Omnia']);
    expect(props.projectId?.enum).toEqual(['project_static']);
    expect(props.forceRefresh).toEqual(
      expect.objectContaining({ type: 'string', enum: ['true'] })
    );
  });

  it('maps body properties to description + type (ElevenLabs request_body_schema)', () => {
    const cfg = {
      platform: 'elevenlabs',
      convaiBackendToolTaskIds: ['bk3'],
      tools: [],
    } as IAAgentConfig;

    const tools = buildElevenLabsConvaiPromptTools(cfg, (id) =>
      id === 'bk3'
        ? backendTask({
            id: 'bk3',
            label: 'create_booking',
            backendToolDescription: 'Create booking.',
            endpoint: { url: 'https://api.example.com/book', method: 'POST', headers: {} },
            inputs: [{ internalName: 'queryConstraints', apiParam: 'queryConstraints' }],
          })
        : null
    );

    const api = tools[0].api_schema as Record<string, unknown>;
    const body = api.request_body_schema as Record<string, unknown>;
    const props = body.properties as Record<string, unknown>;
    expect(props.queryConstraints).toEqual(
      expect.objectContaining({
        description: 'Parametro queryConstraints',
        type: 'string',
      })
    );
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

  it('propagates nested OpenAPI jsonSchema properties into ElevenLabs request_body_schema', () => {
    const task = backendTask({
      id: 'nw',
      label: 'next_window',
      backendToolDescription: 'Prossima finestra disponibile.',
      endpoint: { url: 'https://api.example.com/next-window', method: 'POST', headers: {} },
      inputs: [
        { internalName: 'wd', apiParam: 'windowDays', fieldDescription: 'Giorni.' },
        { internalName: 'c', apiParam: 'constraints', variable: '' },
      ],
      backendCallSpecMeta: {
        schemaVersion: 1,
        lastImportedAt: null,
        contentHash: null,
        importState: 'ok',
        structuralFingerprint: null,
        openapiInputUiKindByApiName: { windowDays: 'integer', constraints: 'object' },
        openapiInputJsonSchemaByApiName: {
          windowDays: { type: 'integer', minimum: 1, maximum: 30, description: 'Giorni consecutivi.' },
          constraints: {
            type: 'object',
            description: 'Vincoli opzionali.',
            properties: {
              weekdays: {
                type: 'array',
                items: { type: 'integer', minimum: 0, maximum: 6 },
              },
            },
          },
        },
      },
    } as Partial<Task> & { id: string });

    const built = buildConvaiWebhookToolFromBackendTask(task as Task);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const body = (built.tool.api_schema as Record<string, unknown>).request_body_schema as Record<
      string,
      unknown
    >;
    const props = body.properties as Record<string, Record<string, unknown>>;
    expect(props.windowDays).toEqual(
      expect.objectContaining({ type: 'integer', minimum: 1, maximum: 30 })
    );
    const c = props.constraints;
    expect(c.type).toBe('object');
    const cProps = c.properties as Record<string, Record<string, unknown>>;
    expect(cProps.weekdays.type).toBe('array');
    expect(cProps.weekdays.items).toEqual(
      expect.objectContaining({ type: 'integer', minimum: 0, maximum: 6 })
    );
    expect(JSON.stringify(body)).not.toMatch(/\$ref|additionalProperties/);
  });

  it('buildConvaiWebhookToolFromBackendTask matches single webhook from catalog task', () => {
    const task = backendTask({
      id: 'bk_pub',
      label: 'slots',
      backendToolDescription: 'Lista slot.',
      inputs: [{ internalName: 'n', apiParam: 'n', fieldDescription: 'N' }],
    });
    const single = buildConvaiWebhookToolFromBackendTask(task);
    expect(single.ok).toBe(true);
    if (!single.ok) return;
    const cfg = {
      platform: 'elevenlabs',
      convaiBackendToolTaskIds: ['bk_pub'],
      tools: [],
    } as IAAgentConfig;
    const fromList = buildElevenLabsConvaiPromptTools(cfg, (id) => (id === 'bk_pub' ? task : null));
    expect(fromList).toHaveLength(1);
    expect(single.tool.type).toBe('webhook');
    expect(single.tool.name).toBe(fromList[0].name);
    expect(single.tool.api_schema).toEqual(fromList[0].api_schema);
  });
});
