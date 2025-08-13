import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDDTSimulator } from '../useSimulator';
import type { DDTTemplateV2 } from '../model/ddt.v2.types';

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
      steps: { ask: { base: 'ask', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] }, success: { base: ['ok'] }, confirm: { base: 'c', noInput: ['', '', ''], noMatch: ['', '', ''] } },
      subs: ['day', 'month', 'year'],
    },
    { id: 'day', label: 'Day', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'month', label: 'Month', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'year', label: 'Year', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
  ],
};

describe('useDDTSimulator', () => {
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


