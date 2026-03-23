/**
 * Tests for deep clone of section slices (undo snapshots).
 */

import { describe, expect, it } from 'vitest';
import { createOtDocument } from './otTextDocument';
import { cloneStructuredSectionSlice } from './structuredSectionSliceClone';
import type { StructuredSectionRevisionSlice } from './structuredSectionsRevisionReducer';

describe('cloneStructuredSectionSlice', () => {
  it('clones OT slice independently', () => {
    const ot = createOtDocument('hello');
    const slice: StructuredSectionRevisionSlice = {
      promptBaseText: 'hello',
      deletedMask: new Array(5).fill(false),
      inserts: [],
      refinementOpLog: [],
      storageMode: 'ot',
      ot,
    };
    const copy = cloneStructuredSectionSlice(slice);
    expect(copy).toEqual(slice);
    copy.ot!.currentText = 'changed';
    expect(slice.ot!.currentText).toBe('hello');
  });
});
