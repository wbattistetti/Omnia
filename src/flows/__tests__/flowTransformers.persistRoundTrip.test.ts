/**
 * Ensures buildFlowDocument / save path does not drop graph when nodes use simplified top-level rows.
 */

import { describe, expect, it } from 'vitest';
import { transformNodeToSimplified } from '../flowTransformers';

describe('transformNodeToSimplified (persist round-trip)', () => {
  it('keeps rows from React Flow shape (data.rows)', () => {
    const node = {
      id: 'a',
      type: 'custom',
      position: { x: 1, y: 2 },
      data: { label: 'L', rows: [{ id: 'row1' }] },
    };
    const s = transformNodeToSimplified(node as any);
    expect(s.rows).toHaveLength(1);
    expect(s.label).toBe('L');
  });

  it('falls back to top-level rows when data is missing (simplified snapshot in store)', () => {
    const node = {
      id: 'b',
      type: 'custom',
      position: { x: 0, y: 0 },
      label: 'Top',
      rows: [{ id: 'r2' }],
    };
    const s = transformNodeToSimplified(node as any);
    expect(s.rows).toHaveLength(1);
    expect(s.label).toBe('Top');
  });

  it('prefers non-empty data.rows over empty top-level rows', () => {
    const node = {
      id: 'c',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { label: '', rows: [{ id: 'real' }] },
      rows: [],
    };
    const s = transformNodeToSimplified(node as any);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].id).toBe('real');
  });
});
