// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@context/AIProviderContext', () => ({
  useAIProvider: vi.fn(),
}));

import { useAIProvider } from '@context/AIProviderContext';
import { useAiBusyLabel } from '../useAiBusyLabel';

const mockedAiProvider = vi.mocked(useAIProvider);

function fakeProviderContext(model: string) {
  return {
    model,
    provider: 'openai' as const,
    setProvider: vi.fn(),
    setModel: vi.fn(),
    providerConfig: { id: 'openai' as const, label: 'OpenAI' },
  };
}

describe('useAiBusyLabel', () => {
  beforeEach(() => {
    mockedAiProvider.mockReset();
  });

  it('appends "(model)..." when the global model is set', () => {
    mockedAiProvider.mockReturnValue(fakeProviderContext('gpt-5'));
    const { result } = renderHook(() => useAiBusyLabel());
    expect(result.current.hasModel).toBe(true);
    expect(result.current.model).toBe('gpt-5');
    expect(result.current.busyLabel('Creando use case')).toBe('Creando use case (gpt-5)...');
  });

  it('omits parentheses and signals hasModel=false when the model is empty', () => {
    mockedAiProvider.mockReturnValue(fakeProviderContext(''));
    const { result } = renderHook(() => useAiBusyLabel());
    expect(result.current.hasModel).toBe(false);
    expect(result.current.model).toBe('');
    expect(result.current.busyLabel('Creando use case')).toBe('Creando use case...');
  });

  it('preserves the original gerund phrase verbatim (no trimming, no normalization)', () => {
    mockedAiProvider.mockReturnValue(fakeProviderContext('llama-3.3-70b-versatile'));
    const { result } = renderHook(() => useAiBusyLabel());
    expect(result.current.busyLabel('Sto creando il dialogo per il nuovo use case')).toBe(
      'Sto creando il dialogo per il nuovo use case (llama-3.3-70b-versatile)...'
    );
  });

  it('exposes a stable shape across re-renders so consumers can depend on busyLabel without churn', () => {
    mockedAiProvider.mockReturnValue(fakeProviderContext('gpt-5-mini'));
    const { result, rerender } = renderHook(() => useAiBusyLabel());
    const firstSnapshot = result.current;
    rerender();
    expect(result.current.model).toBe(firstSnapshot.model);
    expect(result.current.hasModel).toBe(firstSnapshot.hasModel);
    expect(result.current.busyLabel('A')).toBe(firstSnapshot.busyLabel('A'));
  });
});
