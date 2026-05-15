/**
 * Tests for merging catalog preset style contract with designer learning notes.
 */

import { describe, expect, it } from 'vitest';
import { mergeUseCaseGlobalStyleContract } from '../mergeUseCaseGlobalStyleContract';

describe('mergeUseCaseGlobalStyleContract', () => {
  it('returns base trimmed when learning notes empty', () => {
    expect(mergeUseCaseGlobalStyleContract('  Preset  \n', '')).toBe('  Preset');
    expect(mergeUseCaseGlobalStyleContract('Preset', '   \n')).toBe('Preset');
  });

  it('appends learning block when notes non-empty', () => {
    const out = mergeUseCaseGlobalStyleContract('BASE', 'NOTE');
    expect(out.startsWith('BASE')).toBe(true);
    expect(out).toContain('### Stile da apprendimento (note designer)');
    expect(out.endsWith('NOTE')).toBe(true);
  });
});
