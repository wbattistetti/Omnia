// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AiCallRecord } from '../../services/aiCallsApi';

vi.mock('../../context/AiCallLogContext', () => ({
  useAiCallLog: vi.fn(),
}));

import { useAiCallLog } from '../../context/AiCallLogContext';
import { useLastCallCost } from '../useLastCallCost';

const mockedUseAiCallLog = vi.mocked(useAiCallLog);

function makeRecord(partial: Partial<AiCallRecord> = {}): AiCallRecord {
  return {
    id: partial.id ?? 'rec-1',
    ts: partial.ts ?? new Date().toISOString(),
    providerId: partial.providerId ?? 'openai',
    modelId: partial.modelId ?? 'gpt-5',
    purpose: partial.purpose ?? 'CONVERSATION_POSITIVE',
    inputTokens: partial.inputTokens ?? 100,
    outputTokens: partial.outputTokens ?? 50,
    totalTokens: partial.totalTokens ?? 150,
    costUsd: partial.costUsd ?? 0.0042,
    costEur: partial.costEur ?? 0.004,
    durationMs: partial.durationMs ?? 1234,
    pricingFound: partial.pricingFound ?? true,
    error: partial.error ?? null,
  };
}

function setLogState(records: AiCallRecord[]): void {
  const map = new Map<string, AiCallRecord>();
  for (const r of records) {
    if (!map.has(r.purpose)) map.set(r.purpose, r);
  }
  mockedUseAiCallLog.mockReturnValue({
    calls: records,
    lastByPurpose: map,
    loading: false,
    error: null,
    exchangeRate: { usdToEur: 0.92, fetchedAt: null, ecbDate: null },
    refreshNow: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  });
}

describe('useLastCallCost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedUseAiCallLog.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the matching call when it just happened', () => {
    const record = makeRecord({ purpose: 'CONVERSATION_POSITIVE', ts: new Date().toISOString() });
    setLogState([record]);
    const { result } = renderHook(() => useLastCallCost('CONVERSATION_POSITIVE'));
    expect(result.current).not.toBeNull();
    expect(result.current?.record.id).toBe('rec-1');
    expect(result.current?.remainingMs).toBeGreaterThan(0);
  });

  it('returns null after the 15s freshness window elapses', async () => {
    const oldTs = new Date(Date.now() - 16_000).toISOString();
    setLogState([makeRecord({ ts: oldTs })]);
    const { result } = renderHook(() => useLastCallCost('CONVERSATION_POSITIVE'));
    expect(result.current).toBeNull();
  });

  it('still returns the record at 14s (just inside the 15s window)', () => {
    const ts = new Date(Date.now() - 14_000).toISOString();
    setLogState([makeRecord({ ts })]);
    const { result } = renderHook(() => useLastCallCost('CONVERSATION_POSITIVE'));
    expect(result.current).not.toBeNull();
    expect(result.current?.remainingMs).toBeGreaterThan(0);
    expect(result.current?.remainingMs).toBeLessThan(2_000);
  });

  it('returns null when no record matches the requested purpose', () => {
    setLogState([makeRecord({ purpose: 'CONVERSATION_NEGATIVE' })]);
    const { result } = renderHook(() => useLastCallCost('CONVERSATION_POSITIVE'));
    expect(result.current).toBeNull();
  });

  it('returns null when purpose is null/undefined to avoid badge rendering on disabled buttons', () => {
    setLogState([makeRecord()]);
    const { result: r1 } = renderHook(() => useLastCallCost(null));
    const { result: r2 } = renderHook(() => useLastCallCost(undefined));
    expect(r1.current).toBeNull();
    expect(r2.current).toBeNull();
  });

  it('auto-clears the record once the window elapses while mounted', () => {
    const ts = new Date().toISOString();
    setLogState([makeRecord({ ts })]);
    const { result } = renderHook(() => useLastCallCost('CONVERSATION_POSITIVE'));
    expect(result.current).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(16_000);
    });
    expect(result.current).toBeNull();
  });
});
