import { describe, expect, it } from 'vitest';
import {
  useCaseHeaderExcludedDimClass,
  useCaseHeaderTitleTextClass,
} from '../useCaseComposerPresentation';

describe('useCaseHeaderExcludedDimClass', () => {
  it('dims any validation color when excluded from conversations', () => {
    expect(useCaseHeaderExcludedDimClass('up', false)).toContain('opacity');
    expect(useCaseHeaderExcludedDimClass('down', false)).toContain('opacity');
    expect(useCaseHeaderExcludedDimClass('review', false)).toContain('opacity');
    expect(useCaseHeaderExcludedDimClass(undefined, false)).toContain('opacity');
    expect(useCaseHeaderExcludedDimClass('up', true)).toBe('');
  });
});

describe('useCaseHeaderTitleTextClass', () => {
  it('keeps validation hue and dims when excluded', () => {
    const cls = useCaseHeaderTitleTextClass('down', false, false);
    expect(cls).toContain('text-rose');
    expect(cls).toContain('opacity-[0.42]');
  });

  it('dims amber default when excluded', () => {
    const cls = useCaseHeaderTitleTextClass(undefined, false, false);
    expect(cls).toContain('text-amber');
    expect(cls).toContain('opacity-[0.42]');
  });

  it('full opacity when included', () => {
    const cls = useCaseHeaderTitleTextClass('up', false, true);
    expect(cls).toContain('text-emerald');
    expect(cls).not.toContain('opacity-[0.42]');
  });
});
