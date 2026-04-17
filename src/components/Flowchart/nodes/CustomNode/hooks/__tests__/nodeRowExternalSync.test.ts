import { describe, it, expect } from 'vitest';
import {
  mergeExternalRowsFromStore,
  rowListsShallowEqual,
  planExternalRowSync,
} from '../nodeRowExternalSync';
import type { NodeRowData } from '../../../../../../types/project';

function row(id: string, text: string): NodeRowData {
  return { id, text, included: true };
}

describe('mergeExternalRowsFromStore', () => {
  it('when not editing, overlays local text onto display rows for matching ids (props can lag)', () => {
    const display = [row('a', '1'), row('b', '2')];
    const local = [row('a', 'x')];
    expect(mergeExternalRowsFromStore(display, local, null)).toEqual([
      row('a', 'x'),
      row('b', '2'),
    ]);
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

describe('planExternalRowSync', () => {
  it('does not sync when local has more rows than store (pending local add)', () => {
    const display = [row('a', '1')];
    const local = [row('a', '1'), row('b', '')];
    expect(planExternalRowSync(display, local, null)).toEqual({ shouldSync: false });
  });

  it('does not sync on text-only drift when same structure and not editing', () => {
    const display = [row('a', 'from-store')];
    const local = [row('a', 'typing')];
    expect(planExternalRowSync(display, local, null)).toEqual({ shouldSync: false });
  });

  it('syncs when store gains a new row (portal / handled path)', () => {
    const display = [row('a', '1'), row('b', '2')];
    const local = [row('a', '1')];
    const plan = planExternalRowSync(display, local, null);
    expect(plan.shouldSync).toBe(true);
    if (plan.shouldSync) {
      expect(plan.nextRows).toEqual(display);
    }
  });

  it('syncs while editing when sibling rows change', () => {
    const display = [row('a', 'store-a'), row('b', 'new-b')];
    const local = [row('a', 'typing'), row('b', 'old')];
    const plan = planExternalRowSync(display, local, 'a');
    expect(plan.shouldSync).toBe(true);
    if (plan.shouldSync) {
      expect(plan.nextRows[0].text).toBe('typing');
      expect(plan.nextRows[1].text).toBe('new-b');
    }
  });
});
