import { describe, it, expect } from 'vitest';
import { mergeExternalRowsFromStore, rowListsShallowEqual } from '../nodeRowExternalSync';
import type { NodeRowData } from '../../../../../../types/project';

function row(id: string, text: string): NodeRowData {
  return { id, text, included: true };
}

describe('mergeExternalRowsFromStore', () => {
  it('returns displayRows when not editing', () => {
    const display = [row('a', '1'), row('b', '2')];
    const local = [row('a', 'x')];
    expect(mergeExternalRowsFromStore(display, local, null)).toEqual(display);
  });

  it('preserves local row when editing that id', () => {
    const display = [row('a', 'store'), row('b', '2')];
    const local = [row('a', 'typing'), row('b', '2')];
    const out = mergeExternalRowsFromStore(display, local, 'a');
    expect(out[0].text).toBe('typing');
    expect(out[1]).toEqual(display[1]);
  });
});

describe('rowListsShallowEqual', () => {
  it('returns true for equivalent rows', () => {
    const a = [row('1', 't')];
    const b = [row('1', 't')];
    expect(rowListsShallowEqual(a, b)).toBe(true);
  });

  it('returns false when ids differ', () => {
    expect(rowListsShallowEqual([row('1', 'a')], [row('2', 'a')])).toBe(false);
  });
});
