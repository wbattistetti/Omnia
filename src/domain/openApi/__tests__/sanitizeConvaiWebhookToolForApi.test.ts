import { describe, expect, it } from 'vitest';
import {
  sanitizeConvaiConversationConfigForApi,
  sanitizeConvaiWebhookToolForApi,
} from '../sanitizeConvaiWebhookToolForApi';

describe('sanitizeConvaiWebhookToolForApi', () => {
  it('rimuove http_method e campi JSON Schema non ammessi', () => {
    const out = sanitizeConvaiWebhookToolForApi({
      type: 'webhook',
      name: 'bookfromagenda',
      description: 'Prenota slot.',
      api_schema: {
        url: 'https://x/api/runtime/bookfromagenda',
        method: 'POST',
        http_method: 'POST',
        request_body_schema: {
          type: 'object',
          description: 'Body prenotazione.',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project id',
              const: 'proj_1',
              format: 'uuid',
            },
            windowDays: {
              type: 'integer',
              minimum: 1,
              maximum: 30,
              description: 'Giorni.',
            },
          },
          required: ['projectId'],
        },
      },
      response_timeout_secs: 20,
    });

    const api = out.api_schema as Record<string, unknown>;
    expect(api.method).toBe('POST');
    expect(api).not.toHaveProperty('http_method');
    const body = api.request_body_schema as Record<string, unknown>;
    expect(body.description).toBe('Body prenotazione.');
    const props = body.properties as Record<string, Record<string, unknown>>;
    expect(props.projectId.constant_value).toBe('proj_1');
    expect(props.projectId).not.toHaveProperty('const');
    expect(props.projectId).not.toHaveProperty('format');
    expect(props.windowDays).not.toHaveProperty('minimum');
    expect(props.windowDays.description).toBe('Giorni.');
  });

  it('query_params_schema senza description radice', () => {
    const out = sanitizeConvaiWebhookToolForApi({
      type: 'webhook',
      name: 'slots',
      description: 'Lista slot.',
      api_schema: {
        url: 'https://x/slots',
        method: 'GET',
        query_params_schema: {
          description: 'Non ammessa',
          properties: {
            id: { type: 'string', description: 'Id', format: 'uuid' },
          },
        },
      },
    });
    const qps = (out.api_schema as Record<string, unknown>).query_params_schema as Record<
      string,
      unknown
    >;
    expect(qps).not.toHaveProperty('description');
    const id = (qps.properties as Record<string, Record<string, unknown>>).id;
    expect(id).not.toHaveProperty('format');
  });
});

describe('sanitizeConvaiConversationConfigForApi', () => {
  it('sanitizza tools nel prompt', () => {
    const out = sanitizeConvaiConversationConfigForApi({
      agent: {
        prompt: {
          tools: [
            {
              type: 'webhook',
              name: 't',
              description: 'd',
              api_schema: { url: 'https://x', method: 'POST', http_method: 'POST' },
            },
          ],
        },
      },
    });
    const tools = (
      (out.agent as Record<string, unknown>).prompt as Record<string, unknown>
    ).tools as Record<string, unknown>[];
    expect((tools[0].api_schema as Record<string, unknown>).http_method).toBeUndefined();
  });
});
