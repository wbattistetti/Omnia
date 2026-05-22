import { describe, expect, it } from 'vitest';
import {
  useCaseHeaderExcludedDimClass,
  useCaseHeaderTitleTextClass,
} from '../useCaseComposerPresentation';

describe('useCaseHeaderExcludedDimClass', () => {
  it('dims only when excluded and header vote is green (up)', () => {
    expect(useCaseHeaderExcludedDimClass('up', false)).toContain('opacity');
    expect(useCaseHeaderExcludedDimClass('up', true)).toBe('');
    expect(useCaseHeaderExcludedDimClass('down', false)).toBe('');
    expect(useCaseHeaderExcludedDimClass('review', false)).toBe('');
    expect(useCaseHeaderExcludedDimClass(undefined, false)).toBe('');
  });
});

describe('useCaseHeaderTitleTextClass', () => {
  it('keeps full opacity for red when excluded', () => {
    const cls = useCaseHeaderTitleTextClass('down', false, false);
    expect(cls).toContain('text-rose');
    expect(cls).not.toContain('opacity-[0.32]');
  });

  it('dims green when excluded', () => {
    const cls = useCaseHeaderTitleTextClass('up', false, false);
    expect(cls).toContain('text-emerald');
    expect(cls).toContain('opacity-[0.32]');
  });
});
