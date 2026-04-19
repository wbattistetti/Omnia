import { describe, expect, it } from 'vitest';
import { dedupeNodeRowsById } from '../dedupeNodeRows';
import type { NodeRowData } from '../../../../../../types/project';

describe('dedupeNodeRowsById', () => {
  it('keeps first occurrence and drops later duplicates by id', () => {
    const a: NodeRowData = {
      id: 'same',
      text: 'first',
      included: true,
    } as NodeRowData;
    const b: NodeRowData = {
      id: 'same',
      text: 'second',
      included: true,
    } as NodeRowData;
    const c: NodeRowData = { id: 'other', text: 'x', included: true } as NodeRowData;
    expect(dedupeNodeRowsById([a, b, c])).toEqual([a, c]);
  });

  it('returns empty for empty or invalid input', () => {
    expect(dedupeNodeRowsById(undefined)).toEqual([]);
    expect(dedupeNodeRowsById(null)).toEqual([]);
    expect(dedupeNodeRowsById([])).toEqual([]);
  });

  it('skips rows with empty id', () => {
    const bad = { id: '   ', text: 'nope', included: true } as NodeRowData;
    const good = { id: 'ok', text: 'y', included: true } as NodeRowData;
    expect(dedupeNodeRowsById([bad, good])).toEqual([good]);
  });
});
