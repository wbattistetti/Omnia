import { describe, expect, it } from 'vitest';
import {
  partitionMovedTaskVariableIdsByParentReference,
  wiringVariableIdsForSubflow,
} from '../subflowMoveParentPolicy';

describe('subflowMoveParentPolicy (§4E)', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  const c = '33333333-3333-4333-8333-333333333333';

  it('partitionMovedTaskVariableIdsByParentReference intersects task vars with parent refs', () => {
    const task = new Set([a, b, c]);
    const parentRefs = new Set([b, 'ffffffff-ffff-4fff-8fff-ffffffffffff']);
    const p = partitionMovedTaskVariableIdsByParentReference(task, parentRefs);
    expect(p.referencedForMovedTask).toEqual([b]);
    expect(p.unreferencedForMovedTask).toEqual([a, c]);
    expect(p.referencedSet.has(b)).toBe(true);
    expect(p.referencedSet.has(a)).toBe(false);
  });

  it('wiringVariableIdsForSubflow exposes all or referenced-only', () => {
    const s2 = [a, b, c].sort();
    const ref = [b];
    expect(wiringVariableIdsForSubflow(s2, ref, true)).toEqual(s2);
    expect(wiringVariableIdsForSubflow(s2, ref, false)).toEqual(ref);
  });
});
