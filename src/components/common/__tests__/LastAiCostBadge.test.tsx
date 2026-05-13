// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AiCallRecord } from '../../../services/aiCallsApi';

vi.mock('@hooks/useLastCallCost', () => ({
  useLastCallCost: vi.fn(),
}));
vi.mock('@context/AiCallLogContext', () => ({
  useAiCallLog: vi.fn(),
}));

import { useLastCallCost } from '@hooks/useLastCallCost';
import { useAiCallLog } from '@context/AiCallLogContext';
import { LastAiCostBadge } from '../LastAiCostBadge';

const mockedUseLastCallCost = vi.mocked(useLastCallCost);
const mockedUseAiCallLog = vi.mocked(useAiCallLog);

function record(partial: Partial<AiCallRecord> = {}): AiCallRecord {
  return {
    id: 'r1',
    ts: new Date().toISOString(),
    providerId: 'openai',
    modelId: 'gpt-5',
    purpose: 'CONVERSATION_POSITIVE',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd: 0.0042,
    costEur: 0.004,
    durationMs: 1234,
    pricingFound: true,
    error: null,
    ...partial,
  };
}

function setExchangeRate(usdToEur: number | null): void {
  mockedUseAiCallLog.mockReturnValue({
    calls: [],
    lastByPurpose: new Map(),
    loading: false,
    error: null,
    exchangeRate: usdToEur === null ? null : { usdToEur, fetchedAt: null, ecbDate: null },
    refreshNow: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  });
}

describe('LastAiCostBadge', () => {
  beforeEach(() => {
    mockedUseLastCallCost.mockReset();
    mockedUseAiCallLog.mockReset();
  });

  it('renders nothing when there is no recent matching call (badge stays out of the DOM)', () => {
    mockedUseLastCallCost.mockReturnValue(null);
    setExchangeRate(0.92);
    const { container } = render(<LastAiCostBadge purpose="CONVERSATION_POSITIVE" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows EUR cost in cents notation when STRICTLY below 10 cent (= 0.10 EUR)', () => {
    mockedUseLastCallCost.mockReturnValue({
      record: record({ costEur: 0.004, costUsd: 0.0042 }),
      ageMs: 1000,
      remainingMs: 14000,
    });
    setExchangeRate(0.92);
    render(<LastAiCostBadge purpose="CONVERSATION_POSITIVE" />);
    expect(screen.getByText(/Last: 0,40 cent\./)).toBeInTheDocument();
  });

  it('shows EUR in decimal notation when at or above the 10 cent threshold', () => {
    mockedUseLastCallCost.mockReturnValue({
      record: record({ costEur: 0.15, costUsd: 0.16 }),
      ageMs: 1000,
      remainingMs: 14000,
    });
    setExchangeRate(0.92);
    render(<LastAiCostBadge purpose="CONVERSATION_POSITIVE" />);
    expect(screen.getByText(/Last: 0,15/)).toBeInTheDocument();
  });

  it('shows EUR with the standard symbol when the cost crosses 1 EUR', () => {
    mockedUseLastCallCost.mockReturnValue({
      record: record({ costEur: 1.5, costUsd: 1.6 }),
      ageMs: 1000,
      remainingMs: 14000,
    });
    setExchangeRate(0.92);
    render(<LastAiCostBadge purpose="CONVERSATION_POSITIVE" />);
    expect(screen.getByText(/1,50/)).toBeInTheDocument();
  });

  it('falls back to USD cents when the FX rate is not available', () => {
    mockedUseLastCallCost.mockReturnValue({
      record: record({ costEur: null, costUsd: 0.0042 }),
      ageMs: 1000,
      remainingMs: 14000,
    });
    setExchangeRate(null);
    render(<LastAiCostBadge purpose="CONVERSATION_POSITIVE" />);
    expect(screen.getByText(/Last: 0\.42 cent\./)).toBeInTheDocument();
  });

  it('exposes the call error inline when the last call failed (no silent swallowing)', () => {
    mockedUseLastCallCost.mockReturnValue({
      record: record({ error: 'Provider HTTP 500' }),
      ageMs: 1000,
      remainingMs: 9000,
    });
    setExchangeRate(0.92);
    render(<LastAiCostBadge purpose="CONVERSATION_POSITIVE" />);
    expect(screen.getByText(/Last \(errore\): Provider HTTP 500/)).toBeInTheDocument();
  });
});
