import { describe, expect, it } from 'vitest';
import { rowListsShallowEqual } from '../nodeRowExternalSync';
import type { NodeRowData } from '../../../../../../types/project';

function row(id: string, text: string): NodeRowData {
  return { id, text, included: true } as NodeRowData;
}

describe('rowListsShallowEqual', () => {
  it('returns true for same ids and payloads', () => {
    const a = [row('1', 'a'), row('2', 'b')];
    const b = [row('1', 'a'), row('2', 'b')];
    expect(rowListsShallowEqual(a, b)).toBe(true);
  });

  it('returns false when ids differ', () => {
    expect(rowListsShallowEqual([row('1', 'a')], [row('2', 'a')])).toBe(false);
  });
});
