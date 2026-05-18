import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearLayoutEmitDedupe,
  shouldSkipDuplicateLayoutEmit,
} from '../flowLayoutEmitDedupe';

describe('flowLayoutEmitDedupe', () => {
  beforeEach(() => {
    clearLayoutEmitDedupe();
  });

  it('allows first emit then skips duplicate size', () => {
    expect(shouldSkipDuplicateLayoutEmit('main', 'n1', 100, 50)).toBe(false);
    expect(shouldSkipDuplicateLayoutEmit('main', 'n1', 100, 50)).toBe(true);
    expect(shouldSkipDuplicateLayoutEmit('main', 'n1', 101, 51)).toBe(true);
  });

  it('allows emit when size changes beyond epsilon', () => {
    expect(shouldSkipDuplicateLayoutEmit('main', 'n1', 100, 50)).toBe(false);
    expect(shouldSkipDuplicateLayoutEmit('main', 'n1', 120, 50)).toBe(false);
  });
});
