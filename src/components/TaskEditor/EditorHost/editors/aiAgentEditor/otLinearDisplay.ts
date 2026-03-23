/**
 * Derives linear revision mask/inserts from IA base + effective body so OT sections can reuse
 * the same dual-layer mirror (strikethrough / green inserts) as the legacy linear path.
 *
 * Uses {@link splitPrefixSuffixMiddle} so deletions and insertions form one contiguous change
 * region (never interlaced character-by-character).
 */

import type { InsertOp } from './effectiveFromRevisionMask';
import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';
import { splitPrefixSuffixMiddle } from './revisionStringDiff';

function newInsertId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `ot-lin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Builds {@link deletedMask} + {@link inserts} such that
 * {@link effectiveFromRevisionMask}(base, deletedMask, inserts) === effective (UTF-16).
 *
 * Marks exactly the differing middle block of {@link base} as deleted and inserts
 * {@link effective}'s middle as a single contiguous run at the shared prefix position.
 */
export function effectivePairToMaskAndInserts(
  base: string,
  effective: string
): { deletedMask: boolean[]; inserts: InsertOp[] } {
  const deletedMask = new Array(Math.max(0, base.length)).fill(false);
  const inserts: InsertOp[] = [];

  if (base === effective) {
    return { deletedMask, inserts };
  }

  const { prefixLen, suffixLen, bMiddle } = splitPrefixSuffixMiddle(base, effective);
  const baseEnd = base.length - suffixLen;
  for (let k = prefixLen; k < baseEnd; k++) {
    deletedMask[k] = true;
  }

  if (bMiddle.length > 0) {
    inserts.push({ id: newInsertId(), position: prefixLen, text: bMiddle });
  }

  return { deletedMask, inserts };
}

/** Verifies round-trip for debugging/tests. */
export function assertEffectiveRoundTrip(base: string, effective: string): void {
  const { deletedMask, inserts } = effectivePairToMaskAndInserts(base, effective);
  const got = effectiveFromRevisionMask(base, deletedMask, inserts);
  if (got !== effective) {
    throw new Error(
      `effectivePairToMaskAndInserts round-trip failed: expected ${effective.length} chars, got ${got.length}`
    );
  }
}
