import { describe, it, expect } from 'vitest';
import { removeSlotBindingsForGrammarSlotId } from '../grammar';

describe('removeSlotBindingsForGrammarSlotId (G2)', () => {
  it('removes the row matching grammarSlotId case-insensitively', () => {
    const rows = [
      { grammarSlotId: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee', flowVariableId: 'v1' },
      { grammarSlotId: 'bbbbbbbb-bbbb-4ccc-dddd-eeeeeeeeeeee', flowVariableId: 'v2' },
    ];
    const out = removeSlotBindingsForGrammarSlotId(rows, 'AAAAAAAA-BBBB-4CCC-DDDD-EEEEEEEEEEEE');
    expect(out).toHaveLength(1);
    expect(out[0].flowVariableId).toBe('v2');
  });

  it('returns empty array when slotBindings undefined', () => {
    expect(removeSlotBindingsForGrammarSlotId(undefined, 'x')).toEqual([]);
  });
});
