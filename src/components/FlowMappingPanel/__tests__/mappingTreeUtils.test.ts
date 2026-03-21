import { describe, it, expect } from 'vitest';
import { buildMappingTree, renameLeafSegment } from '../mappingTreeUtils';
import type { MappingEntry } from '../mappingTypes';

function e(path: string, id = path): MappingEntry {
  return {
    id,
    internalPath: path,
    apiField: '',
    linkedVariable: '',
    externalName: path,
  };
}

describe('buildMappingTree', () => {
  it('groups dotted paths and attaches entries at leaves', () => {
    const tree = buildMappingTree([
      e('data di nascita', '1'),
      e('data di nascita.giorno', '2'),
      e('data di nascita.mese', '3'),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].segment).toBe('data di nascita');
    expect(tree[0].entry?.id).toBe('1');
    expect(tree[0].children).toHaveLength(2);
  });
});

describe('renameLeafSegment', () => {
  it('replaces last segment', () => {
    expect(renameLeafSegment('a.b.c', 'x')).toBe('a.b.x');
    expect(renameLeafSegment('solo', 't')).toBe('t');
  });
});
