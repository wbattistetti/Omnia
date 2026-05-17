import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  BACKEND_SIGNATURE_READ_FAILURE_MESSAGE,
  resolveToolBackendSignature,
} from '../resolveToolBackendSignature';

vi.mock('@services/openApiBackendCallSpec', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/openApiBackendCallSpec')>();
  return {
    ...actual,
    fetchOpenApiDocumentOperationalThenManualFallback: vi.fn(),
    pickOpenApiPathForReadApi: vi.fn(),
    extractOperationFields: vi.fn(),
  };
});

import {
  extractOperationFields,
  fetchOpenApiDocumentOperationalThenManualFallback,
  pickOpenApiPathForReadApi,
} from '@services/openApiBackendCallSpec';

describe('resolveToolBackendSignature', () => {
  beforeEach(() => {
    vi.mocked(fetchOpenApiDocumentOperationalThenManualFallback).mockReset();
    vi.mocked(pickOpenApiPathForReadApi).mockReset();
    vi.mocked(extractOperationFields).mockReset();
  });

  it('returns user message when URL is empty', async () => {
    const res = await resolveToolBackendSignature('  ');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe(BACKEND_SIGNATURE_READ_FAILURE_MESSAGE);
    }
  });

  it('returns signature rows when OpenAPI resolves', async () => {
    vi.mocked(fetchOpenApiDocumentOperationalThenManualFallback).mockResolvedValue({
      doc: { openapi: '3.0.0', paths: {} },
      sourceUrl: 'https://api.example/openapi.json',
    });
    vi.mocked(pickOpenApiPathForReadApi).mockReturnValue({
      pathKey: '/book',
      method: 'post',
      operationalPathMatched: true,
    });
    vi.mocked(extractOperationFields).mockReturnValue({
      requestParamNames: [],
      requestBodyPropertyNames: ['nome'],
      responsePropertyNames: ['esito'],
      inputDescriptionsByApiName: {},
      outputDescriptionsByApiName: {},
      inputUiKindByApiName: {},
      inputEnumByApiName: {},
    });

    const res = await resolveToolBackendSignature('https://api.example/book', 'POST');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.signature.inputs).toHaveLength(1);
      expect(res.signature.outputs).toHaveLength(1);
      expect(res.signature.sourceUrl).toContain('openapi.json');
    }
  });

  it('returns failure message when fetch throws', async () => {
    vi.mocked(fetchOpenApiDocumentOperationalThenManualFallback).mockRejectedValue(
      new Error('HTTP 404')
    );
    const res = await resolveToolBackendSignature('https://api.example/x', 'GET');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe(BACKEND_SIGNATURE_READ_FAILURE_MESSAGE);
      expect(res.detail).toContain('404');
    }
  });

  it('returns failure when operation has no fields', async () => {
    vi.mocked(fetchOpenApiDocumentOperationalThenManualFallback).mockResolvedValue({
      doc: {},
      sourceUrl: 'https://api.example/openapi.json',
    });
    vi.mocked(pickOpenApiPathForReadApi).mockReturnValue({
      pathKey: '/x',
      method: 'get',
      operationalPathMatched: true,
    });
    vi.mocked(extractOperationFields).mockReturnValue(null);

    const res = await resolveToolBackendSignature('https://api.example/x', 'GET');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe(BACKEND_SIGNATURE_READ_FAILURE_MESSAGE);
    }
  });
});
