import { describe, expect, it } from 'vitest';
import { computeUiStepKeys, describeComputeUiStepKeys, orderStepKeysForUi } from '../computeUiStepKeys';

describe('orderStepKeysForUi', () => {
  it('orders known keys and sorts custom keys', () => {
    expect(orderStepKeysForUi(['noMatch', 'start', 'zCustom', 'aCustom'])).toEqual([
      'start',
      'noMatch',
      'aCustom',
      'zCustom',
    ]);
  });

  it('drops invalid step types', () => {
    expect(orderStepKeysForUi(['start', 'disambiguation', 'noMatch'])).toEqual(['start', 'noMatch']);
  });
});

describe('computeUiStepKeys', () => {
  it('returns introduction only for root', () => {
    expect(
      computeUiStepKeys({
        node: { steps: [{ type: 'introduction' }] },
        selectedRoot: true,
        selectedPath: [],
        selectedSubIndex: null,
      })
    ).toEqual(['introduction']);
  });

  it('reads dictionary steps without throwing', () => {
    expect(
      computeUiStepKeys({
        node: { id: 'n1', steps: { start: {}, noMatch: {} } },
        selectedRoot: false,
        selectedPath: [0],
        selectedSubIndex: null,
      })
    ).toEqual(['start', 'noMatch']);
  });

  it('reads array-shaped steps (MaterializedStep-like) without throwing', () => {
    expect(
      computeUiStepKeys({
        node: {
          id: 'n1',
          steps: [
            { type: 'noMatch', escalations: [] },
            { type: 'start', escalations: [] },
          ],
        },
        selectedRoot: false,
        selectedPath: [0],
        selectedSubIndex: null,
      })
    ).toEqual(['start', 'noMatch']);
  });

  it('uses templateStepId when type is missing', () => {
    expect(
      computeUiStepKeys({
        node: {
          id: 'n1',
          steps: [{ templateStepId: 'confirmation', escalations: [] }],
        },
        selectedRoot: false,
        selectedPath: [0],
        selectedSubIndex: null,
      })
    ).toEqual(['confirmation']);
  });

  it('does not append notConfirmed for sub-node path', () => {
    expect(
      computeUiStepKeys({
        node: { id: 'n1', steps: { start: {} } },
        selectedRoot: false,
        selectedPath: [0, 0],
        selectedSubIndex: null,
      })
    ).toEqual(['start']);
  });

  it('does not append notConfirmed when selectedSubIndex is set', () => {
    expect(
      computeUiStepKeys({
        node: { id: 'n1', steps: { start: {} } },
        selectedRoot: false,
        selectedPath: [0],
        selectedSubIndex: 1,
      })
    ).toEqual(['start']);
  });

  it('returns no keys when node has empty step dictionary (manual: no strip until structure exists)', () => {
    expect(
      computeUiStepKeys({
        node: { id: 'n1', steps: {} },
        selectedRoot: false,
        selectedPath: [0],
        selectedSubIndex: null,
      })
    ).toEqual([]);
  });
});

describe('describeComputeUiStepKeys', () => {
  it('flags hideStripBecauseEmptyOnMainNode when main node has no step keys', () => {
    const d = describeComputeUiStepKeys({
      node: { id: 'n1', steps: {} },
      selectedRoot: false,
      selectedPath: [0],
      selectedSubIndex: null,
    });
    expect(d.hideStripBecauseEmptyOnMainNode).toBe(true);
    expect(d.finalKeys).toEqual([]);
  });

  it('does not flag hide when sub-node path has depth > 1 even if extract is empty', () => {
    const d = describeComputeUiStepKeys({
      node: { id: 'n1', steps: {} },
      selectedRoot: false,
      selectedPath: [0, 0],
      selectedSubIndex: null,
    });
    expect(d.hideStripBecauseEmptyOnMainNode).toBe(false);
  });
});
