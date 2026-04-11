/**
 * insertInterfaceEntryAt / reorderMappingEntries for Interface mapping lists.
 */

import { describe, expect, it } from 'vitest';
import { createMappingEntry } from '../mappingTypes';
import { insertInterfaceEntryAt, reorderMappingEntries } from '../mappingTreeUtils';

function entry(path: string) {
  return createMappingEntry({ wireKey: path });
}

describe('insertInterfaceEntryAt', () => {
  it('appends when placement is append', () => {
    const a = entry('a');
    const b = entry('b');
    const next = insertInterfaceEntryAt([a], b, 'a', 'append');
    expect(next.map((e) => e.wireKey)).toEqual(['a', 'b']);
  });

  it('inserts before target path', () => {
    const a = entry('a');
    const b = entry('b');
    const c = entry('c');
    const next = insertInterfaceEntryAt([a, b], c, 'b', 'before');
    expect(next.map((e) => e.wireKey)).toEqual(['a', 'c', 'b']);
  });

  it('inserts after target path', () => {
    const a = entry('a');
    const b = entry('b');
    const c = entry('c');
    const next = insertInterfaceEntryAt([a, b], c, 'a', 'after');
    expect(next.map((e) => e.wireKey)).toEqual(['a', 'c', 'b']);
  });
});

describe('reorderMappingEntries', () => {
  it('moves a sibling before another', () => {
    const a = entry('a');
    const b = entry('b');
    const c = entry('c');
    const next = reorderMappingEntries([a, b, c], c.id, a.id, false);
    expect(next.map((e) => e.wireKey)).toEqual(['c', 'a', 'b']);
  });

  it('no-op when different parent paths', () => {
    const a = entry('g.a');
    const b = entry('x.b');
    const next = reorderMappingEntries([a, b], a.id, b.id, false);
    expect(next).toEqual([a, b]);
  });
});
