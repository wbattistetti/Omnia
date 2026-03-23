/**
 * Resolves the user-visible body for one structured section (linear mask vs OT document).
 */

import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';
import type { StructuredSectionRevisionSlice } from './structuredSectionsRevisionReducer';

export function getStructuredSectionEffectiveText(slice: StructuredSectionRevisionSlice): string {
  if (slice.storageMode === 'ot' && slice.ot) {
    return slice.ot.currentText;
  }
  return effectiveFromRevisionMask(slice.promptBaseText, slice.deletedMask, slice.inserts);
}
