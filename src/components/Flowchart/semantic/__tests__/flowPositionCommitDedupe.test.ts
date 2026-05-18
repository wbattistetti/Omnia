import { describe, expect, it } from 'vitest';
import {
  clearPositionCommitDedupe,
  shouldSkipDuplicatePositionCommit,
} from '../flowPositionCommitDedupe';

describe('flowPositionCommitDedupe', () => {
  it('skips identical commits within the dedupe window', () => {
    clearPositionCommitDedupe('main');
    const updates = [{ nodeId: 'a', position: { x: 1, y: 2 } }];
    expect(shouldSkipDuplicatePositionCommit('main', updates)).toBe(false);
    expect(shouldSkipDuplicatePositionCommit('main', updates)).toBe(true);
  });

  it('allows commits when position changes', () => {
    clearPositionCommitDedupe('main');
    expect(
      shouldSkipDuplicatePositionCommit('main', [{ nodeId: 'a', position: { x: 0, y: 0 } }])
    ).toBe(false);
    expect(
      shouldSkipDuplicatePositionCommit('main', [{ nodeId: 'a', position: { x: 10, y: 0 } }])
    ).toBe(false);
  });
});
