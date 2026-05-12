// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@services/iaCatalogApi', () => {
  class MockCatalogApiError extends Error {
    readonly status: number;
    readonly code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.name = 'CatalogApiError';
      this.status = status;
      this.code = code;
    }
  }
  return {
    CatalogApiError: MockCatalogApiError,
    fetchCatalogModels: vi.fn(),
  };
});

import { fetchCatalogModels, CatalogApiError } from '@services/iaCatalogApi';
import { useAvailableLlmModels } from '../useAvailableLlmModels';

const fetchMock = vi.mocked(fetchCatalogModels);

function modelRow(id: string, name?: string) {
  return {
    model_id: id,
    name: name ?? id,
    provider: 'unknown',
    latency_ms: null,
    cost_hint: null,
    capabilities: {},
    tags: [],
    notes: null,
  };
}

describe('useAvailableLlmModels', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('merges responses from multiple providers and sorts the union alphabetically by label', async () => {
    fetchMock.mockImplementation(async (provider) => {
      if (provider === 'openai') {
        return [modelRow('gpt-5'), modelRow('gpt-4o-mini'), modelRow('gpt-4o')];
      }
      if (provider === 'groq') {
        return [modelRow('llama-3.3-70b-versatile'), modelRow('llama-3.1-8b-instant')];
      }
      return [];
    });

    const { result } = renderHook(() =>
      useAvailableLlmModels([
        { id: 'openai', displayLabel: 'OpenAI' },
        { id: 'groq', displayLabel: 'Groq' },
      ])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.errors).toEqual([]);
    expect(result.current.items.map((m) => m.label)).toEqual([
      '[Groq] llama-3.1-8b-instant',
      '[Groq] llama-3.3-70b-versatile',
      '[OpenAI] gpt-4o',
      '[OpenAI] gpt-4o-mini',
      '[OpenAI] gpt-5',
    ]);
    expect(result.current.items.map((m) => m.provider)).toEqual([
      'groq',
      'groq',
      'openai',
      'openai',
      'openai',
    ]);
    expect(result.current.items.map((m) => m.id)).toEqual([
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-5',
    ]);
  });

  it('keeps the successful providers and reports errors for the failed ones (no silent swallow)', async () => {
    fetchMock.mockImplementation(async (provider) => {
      if (provider === 'openai') return [modelRow('gpt-5')];
      throw new CatalogApiError('Groq key missing', 503, 'EMPTY_MODEL_CATALOG');
    });

    const { result } = renderHook(() =>
      useAvailableLlmModels([
        { id: 'openai', displayLabel: 'OpenAI' },
        { id: 'groq', displayLabel: 'Groq' },
      ])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      id: 'gpt-5',
      label: '[OpenAI] gpt-5',
      provider: 'openai',
    });
    expect(result.current.errors).toEqual([
      { provider: 'groq', message: 'Groq key missing', code: 'EMPTY_MODEL_CATALOG' },
    ]);
  });

  it('uses the catalog `name` field for the human label when available', async () => {
    fetchMock.mockResolvedValue([modelRow('claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5')]);

    const { result } = renderHook(() =>
      useAvailableLlmModels([{ id: 'anthropic', displayLabel: 'Anthropic' }])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items[0].label).toBe('[Anthropic] Claude Sonnet 4.5');
    expect(result.current.items[0].id).toBe('claude-sonnet-4-5-20250929');
  });

  it('returns an empty list and skips fetching when no provider is requested', async () => {
    const { result } = renderHook(() => useAvailableLlmModels([]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.errors).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refetches when reload() is invoked', async () => {
    fetchMock.mockResolvedValue([modelRow('gpt-5')]);

    const { result } = renderHook(() =>
      useAvailableLlmModels([{ id: 'openai', displayLabel: 'OpenAI' }])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('skips entries without a model_id (defensive guard)', async () => {
    fetchMock.mockResolvedValue([
      modelRow('gpt-5'),
      { ...modelRow(''), model_id: '' },
    ]);

    const { result } = renderHook(() =>
      useAvailableLlmModels([{ id: 'openai', displayLabel: 'OpenAI' }])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((m) => m.id)).toEqual(['gpt-5']);
  });
});
