import { describe, expect, it } from 'vitest';
import {
  formatUseCaseBundleProgressBanner,
  resolveUseCaseBundleGeneratingLabel,
} from '../useCaseBundleChunkConfig';

describe('formatUseCaseBundleProgressBanner', () => {
  it('describes partial progress when count is positive', () => {
    expect(formatUseCaseBundleProgressBanner(5, false)).toContain('5');
    expect(formatUseCaseBundleProgressBanner(5, false)).toMatch(/altri/i);
  });

  it('uses ordering copy when final sort runs', () => {
    expect(formatUseCaseBundleProgressBanner(10, true)).toMatch(/riordinando/i);
  });

  it('falls back when count is unknown', () => {
    expect(formatUseCaseBundleProgressBanner(null, false)).toMatch(/generando/i);
  });
});

describe('resolveUseCaseBundleGeneratingLabel', () => {
  it('keeps compact button label with count', () => {
    expect(resolveUseCaseBundleGeneratingLabel(3, false)).toBe('Generando use case… (3)');
  });
});
