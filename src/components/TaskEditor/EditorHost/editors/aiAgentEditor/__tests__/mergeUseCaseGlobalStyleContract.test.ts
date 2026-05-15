/**
 * Tests for merging catalog preset style contract with designer learning notes.
 */

import { describe, expect, it } from 'vitest';
import {
  mergeUseCaseGlobalStyleContract,
  parseStyleContractToLearningNotes,
  USE_CASE_FULL_STYLE_NOTES_PREFIX,
} from '../mergeUseCaseGlobalStyleContract';

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

  it('uses full override when notes carry __FULL_STYLE__ prefix', () => {
    const full = 'Solo call center, frasi brevi.';
    const notes = `${USE_CASE_FULL_STYLE_NOTES_PREFIX}${full}`;
    expect(mergeUseCaseGlobalStyleContract('BASE', notes)).toBe(full);
  });

  it('parseStyleContractToLearningNotes round-trips appended notes', () => {
    const merged = mergeUseCaseGlobalStyleContract('BASE', 'extra');
    expect(parseStyleContractToLearningNotes(merged, 'BASE')).toBe('extra');
    expect(parseStyleContractToLearningNotes('BASE', 'BASE')).toBe('');
  });

  it('parseStyleContractToLearningNotes stores full replacement when text diverges from base', () => {
    const custom = 'Messaggi sintetici call center.';
    const notes = parseStyleContractToLearningNotes(custom, 'BASE');
    expect(notes.startsWith(USE_CASE_FULL_STYLE_NOTES_PREFIX)).toBe(true);
    expect(mergeUseCaseGlobalStyleContract('BASE', notes)).toBe(custom);
  });
});
