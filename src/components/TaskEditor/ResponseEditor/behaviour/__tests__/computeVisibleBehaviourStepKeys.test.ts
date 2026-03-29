import { describe, expect, it } from 'vitest';
import { computeVisibleBehaviourStepKeys } from '../computeVisibleBehaviourStepKeys';

describe('computeVisibleBehaviourStepKeys', () => {
  it('returns all stepKeys when repository slice for the node is empty', () => {
    expect(
      computeVisibleBehaviourStepKeys(['start', 'noMatch', 'notConfirmed'], {}, { start: {}, noMatch: {} })
    ).toEqual(['start', 'noMatch', 'notConfirmed']);
  });

  it('filters by repository when slice exists', () => {
    expect(
      computeVisibleBehaviourStepKeys(
        ['start', 'noMatch'],
        { start: { type: 'start' }, noMatch: { type: 'noMatch' } },
        {}
      )
    ).toEqual(['start', 'noMatch']);
  });

  it('drops disabled steps from repository', () => {
    expect(
      computeVisibleBehaviourStepKeys(
        ['start', 'noMatch'],
        { start: { _disabled: true }, noMatch: {} },
        {}
      )
    ).toEqual(['noMatch']);
  });

  it('keeps a step that exists only on node when repo has other keys', () => {
    expect(
      computeVisibleBehaviourStepKeys(
        ['start', 'noMatch'],
        { start: { type: 'start' } },
        { noMatch: { type: 'noMatch' } }
      )
    ).toEqual(['start', 'noMatch']);
  });
});
