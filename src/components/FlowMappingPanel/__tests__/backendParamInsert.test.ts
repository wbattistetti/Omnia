import { describe, expect, it } from 'vitest';
import { createMappingEntry } from '../mappingTypes';
import { entriesInDepthFirstOrder } from '../mappingTreeUtils';
import {
  EPHEMERAL_SEGMENT_PREFIX,
  computeBackendParamInsert,
  insertNewBackendParameter,
  isEphemeralNewSegment,
  subtreeEntryIndices,
  uniqueSegmentUnderParent,
} from '../backendParamInsert';

describe('subtreeEntryIndices', () => {
  it('collects exact path and descendants', () => {
    const entries = [
      createMappingEntry({ internalPath: 'a' }),
      createMappingEntry({ internalPath: 'a.b' }),
      createMappingEntry({ internalPath: 'a.c' }),
    ];
    expect(subtreeEntryIndices(entries, 'a')).toEqual([0, 1, 2]);
    expect(subtreeEntryIndices(entries, 'a.b')).toEqual([1]);
  });
});

describe('isEphemeralNewSegment', () => {
  it('detects prefix', () => {
    expect(isEphemeralNewSegment(`${EPHEMERAL_SEGMENT_PREFIX}abc123`)).toBe(true);
    expect(isEphemeralNewSegment('stato')).toBe(false);
  });
});

describe('uniqueSegmentUnderParent', () => {
  it('returns ephemeral segment', () => {
    const s = uniqueSegmentUnderParent([], '');
    expect(s.startsWith(EPHEMERAL_SEGMENT_PREFIX)).toBe(true);
  });

  it('avoids collision', () => {
    const existing = `${EPHEMERAL_SEGMENT_PREFIX}dup`;
    const entries = [createMappingEntry({ internalPath: existing })];
    const s = uniqueSegmentUnderParent(entries, '');
    expect(s.startsWith(EPHEMERAL_SEGMENT_PREFIX)).toBe(true);
    expect(s).not.toBe(existing);
  });
});

describe('computeBackendParamInsert', () => {
  it('empty tree root insert', () => {
    const r = computeBackendParamInsert([], { targetPathKey: '', placement: 'after' });
    expect(r.insertAt).toBe(0);
    expect(r.internalPath.startsWith(EPHEMERAL_SEGMENT_PREFIX)).toBe(true);
  });

  it('inserts before target in alphabetical tree order (not raw array tail)', () => {
    const entries = [
      createMappingEntry({ internalPath: 'zebra' }),
      createMappingEntry({ internalPath: 'alfa' }),
      createMappingEntry({ internalPath: 'mike' }),
    ];
    const orderedBefore = entriesInDepthFirstOrder(entries, 'alphabetical');
    expect(orderedBefore.map((e) => e.internalPath)).toEqual(['alfa', 'mike', 'zebra']);

    const { next, newEntry } = insertNewBackendParameter(
      entries,
      { targetPathKey: 'mike', placement: 'before' },
      { siblingOrder: 'alphabetical' }
    );
    const orderedAfter = entriesInDepthFirstOrder(next, 'alphabetical');
    const newIdx = orderedAfter.findIndex((e) => e.id === newEntry.id);
    const mikeIdx = orderedAfter.findIndex((e) => e.internalPath === 'mike');
    expect(newIdx).toBe(mikeIdx - 1);
    expect(newIdx).toBeGreaterThan(-1);
  });
});

describe('insertNewBackendParameter', () => {
  it('inserts one row for empty list', () => {
    const { next, newEntry } = insertNewBackendParameter([], { targetPathKey: '', placement: 'after' });
    expect(next).toHaveLength(1);
    expect(newEntry.internalPath.startsWith(EPHEMERAL_SEGMENT_PREFIX)).toBe(true);
    expect(newEntry.externalName).toBe('');
    expect(next[0].id).toBe(newEntry.id);
  });
});
