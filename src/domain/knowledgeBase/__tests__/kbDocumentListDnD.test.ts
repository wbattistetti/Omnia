import { describe, expect, it } from 'vitest';
import { estimateKbListWidthPx, reorderKbDocuments } from '../kbDocumentListDnD';

describe('reorderKbDocuments', () => {
  it('moves item before target', () => {
    expect(reorderKbDocuments(['a', 'b', 'c'], 2, 0, 'before')).toEqual(['c', 'a', 'b']);
  });

  it('moves item after target', () => {
    expect(reorderKbDocuments(['a', 'b', 'c'], 0, 2, 'after')).toEqual(['b', 'c', 'a']);
  });
});

describe('estimateKbListWidthPx', () => {
  it('grows with longer names within bounds', () => {
    const short = estimateKbListWidthPx([{ name: 'a.txt' }], 140, 0.45, 1000);
    const long = estimateKbListWidthPx([{ name: 'very-long-document-name-here.pdf' }], 140, 0.45, 1000);
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThanOrEqual(450);
  });
});
