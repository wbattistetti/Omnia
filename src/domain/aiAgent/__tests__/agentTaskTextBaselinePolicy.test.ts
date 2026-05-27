import { describe, expect, it } from 'vitest';
import { taskTextDraftDiffersFromAgentBaseline } from '../agentTaskTextBaselinePolicy';

describe('agentTaskTextBaselinePolicy', () => {
  it('returns false when baseline is empty', () => {
    expect(taskTextDraftDiffersFromAgentBaseline('edited', '')).toBe(false);
  });

  it('returns false when draft matches normalized baseline', () => {
    expect(taskTextDraftDiffersFromAgentBaseline('  hello \n', 'hello')).toBe(false);
  });

  it('returns true when draft differs from baseline', () => {
    expect(taskTextDraftDiffersFromAgentBaseline('hello world', 'hello')).toBe(true);
  });
});
