import { describe, it, expect } from 'vitest';
import {
  normalizeRootUseCaseDraftDisplay,
  parseRootUseCaseDraftSegments,
  ROOT_USE_CASE_BATCH_MAX,
} from '../parseRootUseCaseDraft';

describe('parseRootUseCaseDraftSegments', () => {
  it('splits on semicolon', () => {
    expect(parseRootUseCaseDraftSegments('a;b;c')).toEqual(['a', 'b', 'c']);
  });

  it('splits on comma', () => {
    expect(parseRootUseCaseDraftSegments('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('splits on mixed separators', () => {
    expect(parseRootUseCaseDraftSegments('a;b, c')).toEqual(['a', 'b', 'c']);
  });

  it('splits on newlines (one scenario per line)', () => {
    expect(parseRootUseCaseDraftSegments('line1\nline2\nline3')).toEqual(['line1', 'line2', 'line3']);
    expect(parseRootUseCaseDraftSegments('line1\r\nline2')).toEqual(['line1', 'line2']);
  });

  it('trims and drops empties', () => {
    expect(parseRootUseCaseDraftSegments(' x ;  ; y ')).toEqual(['x', 'y']);
  });
});

describe('normalizeRootUseCaseDraftDisplay', () => {
  it('renders one line per segment', () => {
    expect(normalizeRootUseCaseDraftDisplay('foo;bar;baz')).toBe('foo\nbar\nbaz');
    expect(normalizeRootUseCaseDraftDisplay('foo,bar,baz')).toBe('foo\nbar\nbaz');
    expect(normalizeRootUseCaseDraftDisplay('foo\nbar\nbaz')).toBe('foo\nbar\nbaz');
  });
});

describe('ROOT_USE_CASE_BATCH_MAX', () => {
  it('is a positive cap', () => {
    expect(ROOT_USE_CASE_BATCH_MAX).toBeGreaterThan(0);
  });
});
