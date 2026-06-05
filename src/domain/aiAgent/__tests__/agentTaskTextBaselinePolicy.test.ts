import { describe, expect, it } from 'vitest';
import {
  AGENT_TASK_TEXT_MIN_WORD_DELTA,
  countAgentTaskTextWordDelta,
  shouldAgentTaskTextOfferReview,
  taskTextDraftDiffersFromAgentBaseline,
} from '../agentTaskTextBaselinePolicy';

describe('taskTextDraftDiffersFromAgentBaseline', () => {
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

describe('countAgentTaskTextWordDelta', () => {
  it('counts added words', () => {
    expect(countAgentTaskTextWordDelta('uno due', 'uno due tre quattro')).toBe(2);
  });

  it('ignores punctuation-only changes', () => {
    expect(countAgentTaskTextWordDelta('ciao mondo', 'ciao, mondo!')).toBe(0);
  });
});

describe('shouldAgentTaskTextOfferReview', () => {
  const baseline = '- Primo passo\n- Secondo passo';

  it('false before agent creation', () => {
    expect(
      shouldAgentTaskTextOfferReview({
        baseline,
        draft: `${baseline}\n- Terzo passo`,
        hasAgentGeneration: false,
        hasManualEdit: true,
      })
    ).toBe(false);
  });

  it('false without manual edit (tab switch / sync IA)', () => {
    expect(
      shouldAgentTaskTextOfferReview({
        baseline: '',
        draft: baseline,
        hasAgentGeneration: true,
        hasManualEdit: false,
      })
    ).toBe(false);
  });

  it('false when baseline empty even with manual edit', () => {
    expect(
      shouldAgentTaskTextOfferReview({
        baseline: '',
        draft: 'testo generato',
        hasAgentGeneration: true,
        hasManualEdit: true,
      })
    ).toBe(false);
  });

  it('false for comma-only / trivial diff', () => {
    expect(
      shouldAgentTaskTextOfferReview({
        baseline: 'ciao mondo',
        draft: 'ciao, mondo',
        hasAgentGeneration: true,
        hasManualEdit: true,
      })
    ).toBe(false);
  });

  it('false when fewer than min word delta', () => {
    expect(
      shouldAgentTaskTextOfferReview({
        baseline: 'ciao mondo',
        draft: 'ciao mondo extra',
        hasAgentGeneration: true,
        hasManualEdit: true,
      })
    ).toBe(false);
    expect(AGENT_TASK_TEXT_MIN_WORD_DELTA).toBeGreaterThan(1);
  });

  it('true after meaningful manual edit post-creation', () => {
    expect(
      shouldAgentTaskTextOfferReview({
        baseline,
        draft: `${baseline}\n- Chiedere conferma finale\n- Verificare disponibilità`,
        hasAgentGeneration: true,
        hasManualEdit: true,
      })
    ).toBe(true);
  });
});
