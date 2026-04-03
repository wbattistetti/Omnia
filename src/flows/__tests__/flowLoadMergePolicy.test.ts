import { describe, expect, it } from 'vitest';
import { shouldKeepLocalGraphOnEmptyServerResponse } from '../flowLoadMergePolicy';

describe('shouldKeepLocalGraphOnEmptyServerResponse', () => {
  it('returns true when server is empty, local has nodes, and slice is dirty', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 0,
        localNodeCount: 2,
        hasLocalChanges: true,
        flowId: 'main',
      })
    ).toBe(true);
  });

  it('returns false when server has nodes', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 1,
        localNodeCount: 2,
        hasLocalChanges: true,
      })
    ).toBe(false);
  });

  it('returns false when local has no nodes', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 0,
        localNodeCount: 0,
        hasLocalChanges: true,
      })
    ).toBe(false);
  });

  it('returns false for main flow when hasLocalChanges is not true', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 0,
        localNodeCount: 3,
        hasLocalChanges: false,
        flowId: 'main',
      })
    ).toBe(false);
  });

  it('returns true for subflow slice when server empty and local has nodes even if dirty flag lags', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 0,
        localNodeCount: 2,
        hasLocalChanges: false,
        flowId: 'subflow_x',
      })
    ).toBe(true);
  });
});
