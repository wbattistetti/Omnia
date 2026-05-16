import { describe, expect, it } from 'vitest';
import { matchesAllowedTemplateId, reorderTasksInList } from '../taskSequenceUtils';

describe('matchesAllowedTemplateId', () => {
  it('matches case-insensitively', () => {
    expect(matchesAllowedTemplateId('sendSMS', ['sendsms'])).toBe(true);
    expect(matchesAllowedTemplateId('readFromBackend', ['writeToBackend'])).toBe(false);
  });
});

describe('reorderTasksInList', () => {
  it('moves item before target index', () => {
    expect(reorderTasksInList(['a', 'b', 'c'], 2, 0, 'before')).toEqual(['c', 'a', 'b']);
  });

  it('moves item after target index', () => {
    expect(reorderTasksInList(['a', 'b', 'c'], 0, 1, 'after')).toEqual(['b', 'a', 'c']);
  });
});
