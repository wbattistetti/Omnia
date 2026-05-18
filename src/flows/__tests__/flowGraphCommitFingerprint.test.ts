import { describe, expect, it } from 'vitest';
import {
  fingerprintFlowGraphCommit,
  isSelectionOnlyNodeGraphChange,
} from '../flowGraphCommitFingerprint';

describe('flowGraphCommitFingerprint', () => {
  it('skips identical structural fingerprint', () => {
    const nodes = [{ id: 'a', position: { x: 1, y: 2 }, data: { rows: [] } }];
    expect(fingerprintFlowGraphCommit(nodes, [])).toBe(
      fingerprintFlowGraphCommit(nodes, [])
    );
  });

  it('detects selection-only change', () => {
    const before = [{ id: 'a', position: { x: 0, y: 0 }, selected: false, data: {} }];
    const after = [{ id: 'a', position: { x: 0, y: 0 }, selected: true, data: {} }];
    expect(isSelectionOnlyNodeGraphChange(before, after)).toBe(true);
    expect(fingerprintFlowGraphCommit(before, [])).toBe(
      fingerprintFlowGraphCommit(after, [])
    );
  });
});
