import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebouncedFlowBackendCallsBuffer } from '../debouncedCatalogTriggers';

describe('DebouncedFlowBackendCallsBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('merges rapid FlowBackendCallsChanged into one flush', () => {
    const flush = vi.fn();
    const buf = new DebouncedFlowBackendCallsBuffer(400, flush);
    buf.push('p1', ['a'], 'update');
    buf.push('p1', ['b'], 'update');
    vi.advanceTimersByTime(400);
    expect(flush).toHaveBeenCalledTimes(1);
    const arg = flush.mock.calls[0][0];
    expect(arg.projectId).toBe('p1');
    expect(arg.taskIds.has('a')).toBe(true);
    expect(arg.taskIds.has('b')).toBe(true);
    buf.destroy();
  });
});
