import { describe, it, expect } from 'vitest';
import {
  getEmptyCustomNodeMinWidthPx,
  getEmptyCustomNodeMinWidthFromNodeRowCss,
} from '../emptyCustomNodeMinWidth';

describe('emptyCustomNodeMinWidth', () => {
  it('matches useNodeRendering formula for 14px', () => {
    const charWidth = 14 * 0.6;
    const expected = Math.max(Math.ceil(25 * charWidth + 40), 140);
    expect(getEmptyCustomNodeMinWidthPx(14)).toBe(expected);
    expect(getEmptyCustomNodeMinWidthFromNodeRowCss('14px')).toBe(expected);
  });

  it('never goes below 140', () => {
    expect(getEmptyCustomNodeMinWidthPx(6)).toBe(140);
  });
});
