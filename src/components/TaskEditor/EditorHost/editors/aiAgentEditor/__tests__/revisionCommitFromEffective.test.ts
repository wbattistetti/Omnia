import { describe, expect, it } from 'vitest';
import { commitEffectiveTextChange } from '../revisionCommitFromEffective';

describe('commitEffectiveTextChange', () => {
  it('returns noop when effective unchanged', () => {
    const r = commitEffectiveTextChange({
      baseText: 'hello',
      deletedMask: [],
      inserts: [],
      otMode: false,
      targetEffective: 'hello',
    });
    expect(r.kind).toBe('noop');
  });

  it('returns ot ops for ot mode edits', () => {
    const r = commitEffectiveTextChange({
      baseText: 'one',
      deletedMask: [],
      inserts: [],
      otMode: true,
      otCurrentText: 'one',
      targetEffective: 'two',
    });
    expect(r.kind).toBe('ot');
    if (r.kind === 'ot') expect(r.ops.length).toBeGreaterThan(0);
  });
});
