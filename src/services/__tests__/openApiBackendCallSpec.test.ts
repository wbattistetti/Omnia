import { describe, expect, it, vi } from 'vitest';
import {
  buildOpenApiCandidateUrlList,
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
    expect(r).toEqual({ pathKey: '/pet/{petId}' });
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
    expect(r).toEqual({ pathKey: '/pet' });
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
    expect(pickOpenApiPathForReadApi(url, doc as any, 'POST')).toEqual({ pathKey: '/pet' });
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
    });
  });

  it('pickOpenApiPathForReadApi uses single path when spec has one operation for method', () => {
    const doc = {
      openapi: '3.0.0',
      paths: { '/only': { post: { responses: { '200': { description: 'x' } } } } },
    };
    const r = pickOpenApiPathForReadApi('https://redocly.github.io/redoc/?url=https://x/openapi.json', doc as any, 'POST');
    expect(r).toEqual({ pathKey: '/only' });
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
