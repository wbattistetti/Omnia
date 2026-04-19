import { describe, expect, it } from 'vitest';
import { txnStructuralCommitFlowSlices } from '../txnFlowSliceCommit';

describe('txnStructuralCommitFlowSlices', () => {
  it('returns true when id list is empty (vacuous)', () => {
    expect(txnStructuralCommitFlowSlices({}, [])).toBe(true);
  });

  it('returns false when a slice is missing', () => {
    expect(txnStructuralCommitFlowSlices({ main: {} as any }, ['main', 'missing'])).toBe(false);
  });

  it('returns true when all slices exist', () => {
    expect(
      txnStructuralCommitFlowSlices(
        {
          main: { id: 'main' } as any,
          sub_a: { id: 'sub_a' } as any,
        },
        ['main', 'sub_a']
      )
    ).toBe(true);
  });
});
