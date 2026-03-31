import {
  buildUnifiedBehaviourAddMenuItems,
  computeAddableBehaviourStepKeys,
  getOptionalBehaviourStepTypeCandidates,
} from '../computeAddableBehaviourStepKeys';

describe('computeAddableBehaviourStepKeys', () => {
  it('returns main-field candidates when not sub-node', () => {
    const c = getOptionalBehaviourStepTypeCandidates(false, [0], null);
    expect(c).toContain('confirmation');
    expect(c).toContain('success');
  });

  it('sub-node candidates exclude confirmation and success', () => {
    const c = getOptionalBehaviourStepTypeCandidates(false, [0, 1], null);
    expect(c).toEqual(['noInput', 'invalid']);
  });

  it('adds only keys absent from instance and node', () => {
    const addable = computeAddableBehaviourStepKeys(
      ['noInput', 'confirmation'],
      { noInput: { _disabled: false } },
      {}
    );
    expect(addable).toEqual(['confirmation']);
  });

  it('excludes disabled instance steps (restore path)', () => {
    const addable = computeAddableBehaviourStepKeys(
      ['confirmation'],
      { confirmation: { _disabled: true } },
      {}
    );
    expect(addable).toEqual([]);
  });

  it('excludes keys present on node dict only', () => {
    const addable = computeAddableBehaviourStepKeys(['success'], {}, { success: { type: 'success' } });
    expect(addable).toEqual([]);
  });
});

describe('buildUnifiedBehaviourAddMenuItems', () => {
  it('merges create and restore rows sorted by step order', () => {
    const items = buildUnifiedBehaviourAddMenuItems(
      false,
      [0],
      null,
      {
        confirmation: { _disabled: true, type: 'confirmation', escalations: [] },
      },
      { start: {}, noMatch: {} }
    );
    const modes = items.map((i) => [i.stepKey, i.mode]);
    expect(modes).toContainEqual(['confirmation', 'restore']);
    expect(modes.some((m) => m[0] === 'noInput' && m[1] === 'create')).toBe(true);
  });

  it('lists disabled steps even when not in optional-create palette', () => {
    const items = buildUnifiedBehaviourAddMenuItems(false, [0], null, {
      noMatch: { _disabled: true, type: 'noMatch', escalations: [] },
    }, {});
    expect(items.some((i) => i.stepKey === 'noMatch' && i.mode === 'restore')).toBe(true);
  });
});
