import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDDTSimulator } from '../useSimulator';
import type { DDTTemplateV2 } from '../model/ddt.v2.types';
import type { DataContract } from '../contracts/contractLoader';

const dateMainContract: DataContract = {
  templateName: 'date',
  templateId: 'test-date',
  subDataMapping: {
    day: { groupName: 'day', label: 'Day', type: 'number' },
    month: { groupName: 'month', label: 'Month', type: 'number' },
    year: { groupName: 'year', label: 'Year', type: 'number' },
  },
  engines: [{ type: 'regex', enabled: true, patterns: ['.*'], examples: [] }],
  outputCanonical: { format: 'object', keys: ['day', 'month', 'year'] },
};

const template: DDTTemplateV2 = {
  schemaVersion: '2',
  metadata: { id: 'DDT_Date', label: 'Date' },
  nodes: [
    {
      id: 'date',
      label: 'Date',
      type: 'main',
      required: true,
      kind: 'date',
      dataContract: dateMainContract,
      steps: { ask: { base: 'ask', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] }, success: { base: ['ok'] }, confirm: { base: 'c', noInput: ['', '', ''], noMatch: ['', '', ''] } },
      subs: ['day', 'month', 'year'],
    } as any,
    { id: 'day', label: 'Day', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'month', label: 'Month', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'year', label: 'Year', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
  ],
};

describe('useDDTSimulator', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          values: { day: '12', month: '5', year: '1990' },
          hasMatch: true,
          engine: 'vb-mock',
        }),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('advances after typing delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDDTSimulator(template, { typingIndicatorMs: 100 }));
    act(() => {
      result.current.send('12/05/1990');
      vi.advanceTimersByTime(50);
    });
    // still CollectingMain
    expect(result.current.state.mode).toBe('CollectingMain');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(['ConfirmingMain', 'CollectingSub', 'CollectingMain']).toContain(result.current.state.mode);
    vi.useRealTimers();
  });
});


