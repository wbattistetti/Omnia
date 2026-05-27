import { describe, expect, it } from 'vitest';
import { computeDesignerAddedCharRanges } from '../designerDraftInsertRanges';

describe('computeDesignerAddedCharRanges', () => {
  it('returns empty when baseline is empty', () => {
    expect(computeDesignerAddedCharRanges('', 'new text')).toEqual([]);
  });

  it('returns empty when draft equals baseline', () => {
    expect(computeDesignerAddedCharRanges('same', 'same')).toEqual([]);
  });

  it('marks suffix addition', () => {
    expect(computeDesignerAddedCharRanges('Prima.', 'Prima. Non va sempre chiesta.')).toEqual([
      { start: 6, end: 29 },
    ]);
  });

  it('marks inline insertion', () => {
    expect(computeDesignerAddedCharRanges('ab cd', 'ab NEW cd')).toEqual([
      { start: 3, end: 7 },
    ]);
  });
});
