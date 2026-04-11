import { describe, it, expect } from 'vitest';
import { buildMappingTree, renameLeafSegment } from '../mappingTreeUtils';
import { createFlowInterfaceMappingEntry, type MappingEntry } from '../mappingTypes';

function e(path: string, id = path): MappingEntry {
  return {
    id,
    wireKey: path,
    apiField: '',
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

  it('construction order preserves flat array order for root siblings', () => {
    const tree = buildMappingTree([e('zebra', 'z'), e('alfa', 'a')], { siblingOrder: 'construction' });
    expect(tree.map((n) => n.segment)).toEqual(['zebra', 'alfa']);
  });

  it('alphabetical order sorts root siblings by segment', () => {
    const tree = buildMappingTree([e('zebra', 'z'), e('alfa', 'a')], { siblingOrder: 'alphabetical' });
    expect(tree.map((n) => n.segment)).toEqual(['alfa', 'zebra']);
  });

  it('alphabetical order with any ephemeral row uses construction order so drop position is preserved', () => {
    const tree = buildMappingTree(
      [e('zebra', 'z'), e('__omnia_n_abc', 'eph'), e('alfa', 'a')],
      { siblingOrder: 'alphabetical' }
    );
    expect(tree.map((n) => n.segment)).toEqual(['zebra', '__omnia_n_abc', 'alfa']);
  });

  it('includes subflow interface rows (non-empty default wireKey)', () => {
    const row = createFlowInterfaceMappingEntry({
      variableRefId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(row.wireKey.length).toBeGreaterThan(0);
    const tree = buildMappingTree([row]);
    expect(tree).toHaveLength(1);
    expect(tree[0].segment.startsWith('iface_')).toBe(true);
  });
});

describe('renameLeafSegment', () => {
  it('replaces last segment', () => {
    expect(renameLeafSegment('a.b.c', 'x')).toBe('a.b.x');
    expect(renameLeafSegment('solo', 't')).toBe('t');
  });
});
