import { describe, expect, it } from 'vitest';
import { isFlowContainerSized, measureFlowContainerSize } from '../measureFlowContainerSize';

describe('measureFlowContainerSize', () => {
  it('returns primary size when large enough', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 600, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600, toJSON: () => ({}) }),
    });
    const size = measureFlowContainerSize({ primary: () => el });
    expect(size).toEqual({ width: 800, height: 600 });
    expect(isFlowContainerSized(size)).toBe(true);
  });

  it('falls back when primary is too small', () => {
    const small = document.createElement('div');
    Object.defineProperty(small, 'getBoundingClientRect', {
      value: () => ({ width: 0, height: 0, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }),
    });
    const large = document.createElement('div');
    Object.defineProperty(large, 'getBoundingClientRect', {
      value: () => ({ width: 400, height: 300, x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 300, toJSON: () => ({}) }),
    });
    const size = measureFlowContainerSize({
      primary: () => small,
      fallback: () => large,
    });
    expect(size).toEqual({ width: 400, height: 300 });
  });
});
