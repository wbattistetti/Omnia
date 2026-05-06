import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildOpenApiCandidateUrlList,
  buildOperationDocBlurbFromOpenApiFields,
  extractNestedSpecUrlsFromEndpoint,
  extractOperationFields,
  fetchOpenApiDocument,
  matchOpenApiPath,
  parseOpenApiViewerHash,
  pickOpenApiPathForReadApi,
  slugInternalName,
} from '../openApiBackendCallSpec';

describe('openApiBackendCallSpec', () => {
  it('matchOpenApiPath matches template', () => {
    const paths = { '/users/{id}': { get: {} } };
    expect(matchOpenApiPath(paths as any, '/users/42')).toBe('/users/{id}');
  });

  it('extractOperationFields supports Swagger 2 body + response schema', () => {
    const doc = {
      swagger: '2.0',
      definitions: {
        Pet: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
      paths: {
        '/pet': {
          post: {
            parameters: [
              {
                in: 'body',
                name: 'body',
                schema: { $ref: '#/definitions/Pet' },
              },
            ],
            responses: {
              '200': {
                description: 'ok',
                schema: { $ref: '#/definitions/Pet' },
              },
            },
          },
        },
      },
    };
    const f = extractOperationFields(doc as any, '/pet', 'post');
    expect(f?.requestBodyPropertyNames).toEqual(expect.arrayContaining(['id', 'name', 'status']));
    expect(f?.responsePropertyNames).toEqual(expect.arrayContaining(['id', 'name', 'status']));
    expect(f?.inputDescriptionsByApiName).toEqual({});
    expect(f?.outputDescriptionsByApiName).toEqual({});
    expect(f?.inputUiKindByApiName.id).toBe('number');
    expect(f?.inputUiKindByApiName.name).toBe('text');
  });

  it('extractOperationFields collects params and body fields', () => {
    const doc = {
      openapi: '3.0.0',
      paths: {
        '/x': {
          post: {
            parameters: [{ name: 'q', in: 'query' }],
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } } },
                },
              },
            },
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { out1: { type: 'string' } } },
                  },
                },
              },
            },
          },
        },
      },
    };
    const f = extractOperationFields(doc as any, '/x', 'post');
    expect(f?.requestParamNames).toContain('q');
    expect(f?.requestBodyPropertyNames).toEqual(expect.arrayContaining(['a', 'b']));
    expect(f?.responsePropertyNames).toContain('out1');
    expect(f?.inputDescriptionsByApiName).toEqual({});
    expect(f?.outputDescriptionsByApiName).toEqual({});
    expect(f?.inputUiKindByApiName.q).toBe('text');
    expect(f?.inputUiKindByApiName.a).toBe('text');
    expect(f?.inputUiKindByApiName.b).toBe('number');
  });

  it('extractOperationFields captures OpenAPI descriptions on params and response properties', () => {
    const doc = {
      openapi: '3.0.0',
      paths: {
        '/x': {
          get: {
            parameters: [{ name: 'q', in: 'query', description: '  Query help  ' }],
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        out1: { type: 'string', description: 'Out one' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const f = extractOperationFields(doc as any, '/x', 'get');
    expect(f?.inputDescriptionsByApiName.q).toBe('Query help');
    expect(f?.outputDescriptionsByApiName.out1).toBe('Out one');
  });

  it('extractOperationFields reads operation summary and description', () => {
    const doc = {
      openapi: '3.0.0',
      paths: {
        '/slots': {
          get: {
            summary: 'List slots',
            description: 'Returns available exam slots for the next week.',
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const f = extractOperationFields(doc as any, '/slots', 'get');
    expect(f?.operationSummary).toBe('List slots');
    expect(f?.operationDescription).toBe('Returns available exam slots for the next week.');
    expect(buildOperationDocBlurbFromOpenApiFields(f!)).toContain('List slots');
    expect(buildOperationDocBlurbFromOpenApiFields(f!)).toContain('Returns available exam slots');
  });

  it('slugInternalName normalizes', () => {
    expect(slugInternalName('foo bar')).toBe('foo_bar');
  });

  it('extractNestedSpecUrlsFromEndpoint reads Redoc ?url=', () => {
    const redoc =
      'https://redocly.github.io/redoc/?url=https://petstore.swagger.io/v2/swagger.json#tag/pet';
    expect(extractNestedSpecUrlsFromEndpoint(redoc)).toContain('https://petstore.swagger.io/v2/swagger.json');
  });

  it('buildOpenApiCandidateUrlList includes nested swagger URL from Redoc', () => {
    const redoc = 'https://redocly.github.io/redoc/?url=https://petstore.swagger.io/v2/swagger.json';
    expect(buildOpenApiCandidateUrlList(redoc)).toContain('https://petstore.swagger.io/v2/swagger.json');
  });

  it('pickOpenApiPathForReadApi strips Swagger 2 basePath for real API URL', () => {
    const doc = {
      swagger: '2.0',
      basePath: '/v2',
      paths: {
        '/pet/{petId}': { get: { responses: { 200: { description: 'ok' } } } },
      },
    };
    const r = pickOpenApiPathForReadApi('https://petstore.swagger.io/v2/pet/42', doc as any, 'GET');
    expect(r).toEqual({ pathKey: '/pet/{petId}', method: 'get' });
  });

  it('pickOpenApiPathForReadApi picks first GET path when only Redoc URL (no hash)', () => {
    const doc = {
      swagger: '2.0',
      basePath: '/v2',
      paths: {
        '/pet': { get: {} },
        '/store/inventory': { get: {} },
      },
    };
    const redoc = 'https://redocly.github.io/redoc/?url=https://example.com/v2/swagger.json';
    const r = pickOpenApiPathForReadApi(redoc, doc as any, 'GET');
    expect(r).toEqual({ pathKey: '/pet', method: 'get' });
  });

  it('parseOpenApiViewerHash reads tag and operation', () => {
    expect(parseOpenApiViewerHash('https://x.com/a#tag/pet')).toEqual({ tag: 'pet' });
    expect(parseOpenApiViewerHash('https://x.com/doc#operation/addPet')).toEqual({ operationId: 'addPet' });
  });

  it('pickOpenApiPathForReadApi uses #tag/ to narrow POST paths', () => {
    const doc = {
      swagger: '2.0',
      paths: {
        '/store/order': { post: { tags: ['store'] } },
        '/pet': { post: { tags: ['pet'], operationId: 'addPet' } },
        '/user': { post: { tags: ['user'] } },
      },
    };
    const url = 'https://r.com/redoc/?url=https://x/swagger.json#tag/pet';
    expect(pickOpenApiPathForReadApi(url, doc as any, 'POST')).toEqual({ pathKey: '/pet', method: 'post' });
  });

  it('pickOpenApiPathForReadApi uses #operation/', () => {
    const doc = {
      paths: {
        '/pet': { post: { operationId: 'addPet', tags: ['pet'] } },
        '/x': { post: { operationId: 'other' } },
      },
    };
    expect(pickOpenApiPathForReadApi('https://x.com/doc#operation/addPet', doc as any, 'POST')).toEqual({
      pathKey: '/pet',
      method: 'post',
    });
  });

  it('pickOpenApiPathForReadApi uses single path when spec has one operation for method', () => {
    const doc = {
      openapi: '3.0.0',
      paths: { '/only': { post: { responses: { '200': { description: 'x' } } } } },
    };
    const r = pickOpenApiPathForReadApi('https://redocly.github.io/redoc/?url=https://x/openapi.json', doc as any, 'POST');
    expect(r).toEqual({ pathKey: '/only', method: 'post' });
  });

  it('pickOpenApiPathForReadApi from operational URL auto-selects POST when hint is GET', () => {
    const doc = {
      openapi: '3.0.0',
      paths: {
        '/api/runtime/bookfromagenda': {
          post: { responses: { '200': { description: 'ok' } } },
        },
      },
    };
    const r = pickOpenApiPathForReadApi('http://localhost:3100/api/runtime/bookfromagenda', doc as any, 'GET');
    expect(r).toEqual({ pathKey: '/api/runtime/bookfromagenda', method: 'post' });
  });

  it('extractOperationFields merges allOf request body property names', () => {
    const doc = {
      openapi: '3.0.0',
      components: {
        schemas: {
          Base: {
            type: 'object',
            properties: {
              'agenda.type': { type: 'string', description: 't' },
              'horizon.start': { type: 'string' },
            },
          },
          Extra: {
            type: 'object',
            required: ['queryConstraints'],
            properties: {
              queryConstraints: { type: 'object', description: 'qc' },
            },
          },
          Merged: {
            allOf: [{ $ref: '#/components/schemas/Base' }, { $ref: '#/components/schemas/Extra' }],
          },
        },
      },
      paths: {
        '/api': {
          post: {
            requestBody: {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Merged' } },
              },
            },
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const f = extractOperationFields(doc as any, '/api', 'post');
    expect(f?.requestBodyPropertyNames?.length).toBe(3);
    expect(f?.requestBodyPropertyNames).toEqual(
      expect.arrayContaining(['agenda.type', 'horizon.start', 'queryConstraints'])
    );
    expect(f?.inputDescriptionsByApiName['agenda.type']).toBe('t');
    expect(f?.inputDescriptionsByApiName.queryConstraints).toBe('qc');
  });

  it('extractOperationFields merges oneOf branch keys for body', () => {
    const doc = {
      openapi: '3.0.0',
      paths: {
        '/x': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      { type: 'object', properties: { a: { type: 'string' } } },
                      { type: 'object', properties: { b: { type: 'number' } } },
                    ],
                  },
                },
              },
            },
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const f = extractOperationFields(doc as any, '/x', 'post');
    expect(f?.requestBodyPropertyNames?.length).toBe(2);
    expect(f?.requestBodyPropertyNames).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('extractOperationFields collects enum values and uri kind from body properties', () => {
    const doc = {
      openapi: '3.0.0',
      paths: {
        '/book': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      'agenda.type': {
                        type: 'string',
                        enum: ['Omnia', 'ICS'],
                      },
                      'agenda.url': { type: 'string', format: 'uri' },
                      plain: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const f = extractOperationFields(doc as any, '/book', 'post');
    expect(f?.inputUiKindByApiName['agenda.type']).toBe('enum');
    expect(f?.inputUiKindByApiName['agenda.url']).toBe('uri');
    expect(f?.inputUiKindByApiName.plain).toBe('text');
    expect(f?.inputEnumByApiName['agenda.type']).toEqual(['Omnia', 'ICS']);
    expect(f?.inputEnumByApiName['agenda.url']).toBeUndefined();
  });

  it('extractOperationFields reads x-omnia sendBinding from bookFromAgenda.openapi.json', () => {
    const doc = JSON.parse(
      readFileSync(join(process.cwd(), 'backend/services/bookFromAgenda.openapi.json'), 'utf-8')
    ) as Record<string, unknown>;
    const f = extractOperationFields(doc, '/api/runtime/bookfromagenda', 'post');
    expect(f?.sendBindingRules?.optionalApiParams).toContain('queryConstraints');
    expect(f?.sendBindingRules?.requireOneOfSets?.[0]?.id).toBe('agenda_source_or_cached');
    expect(f?.sendBindingRules?.requireOneOfSets?.[0]?.alternatives).toHaveLength(5);
  });

  it('fetchOpenApiDocument prefers backend proxy when it returns OpenAPI JSON', async () => {
    const doc = { openapi: '3.0.0', paths: { '/x': { get: {} } } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => doc,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const r = await fetchOpenApiDocument('https://example.com/v1/foo');
    expect(r.doc).toEqual(doc);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/openapi-proxy?');
    expect(String(url)).toContain(encodeURIComponent('https://example.com/v1/foo'));
  });
});
