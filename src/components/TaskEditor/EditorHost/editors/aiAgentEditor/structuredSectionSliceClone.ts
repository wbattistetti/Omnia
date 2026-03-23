/**
 * Deep clone for structured section revision slices (undo/redo snapshots).
 */

import type { StructuredSectionRevisionSlice } from './structuredSectionsRevisionReducer';

/**
 * Returns an independent copy of {@link slice} safe to store in history stacks.
 */
export function cloneStructuredSectionSlice(slice: StructuredSectionRevisionSlice): StructuredSectionRevisionSlice {
  if (typeof structuredClone === 'function') {
    return structuredClone(slice);
  }
  const ot = slice.ot
    ? {
        revisionBase: slice.ot.revisionBase,
        opLog: slice.ot.opLog.map((o) =>
          o.type === 'delete'
            ? { type: 'delete' as const, start: o.start, end: o.end }
            : { type: 'insert' as const, position: o.position, text: o.text }
        ),
        currentText: slice.ot.currentText,
      }
    : null;
  return {
    promptBaseText: slice.promptBaseText,
    deletedMask: [...slice.deletedMask],
    inserts: slice.inserts.map((x) => ({ ...x })),
    refinementOpLog: slice.refinementOpLog.map((o) =>
      o.type === 'delete'
        ? { type: 'delete', start: o.start, end: o.end, text: o.text }
        : { type: 'insert', position: o.position, text: o.text }
    ),
    storageMode: slice.storageMode,
    ot,
  };
}
