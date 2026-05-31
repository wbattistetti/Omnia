/**
 * Risolve token compilato (es. datarelativa2) → surface letterale del messaggio.
 */

import type { PhraseCompiledSnapshot } from '@domain/useCaseBundle/schema';
import { parseBaseSlotIdFromToken } from './parseTokenSlotId';

/** Indice 0-based del token numerato per slot_id (data2 → 1). */
export function tokenIndexForSlotOccurrence(token: string, slotId: string): number {
  const suffix = token.slice(slotId.length);
  if (!suffix) return 0;
  const n = Number.parseInt(suffix, 10);
  return Number.isFinite(n) && n > 0 ? n - 1 : 0;
}

/** Surface letterale corrispondente a un token nella variante compilata. */
export function surfaceForCompiledToken(
  snap: PhraseCompiledSnapshot,
  token: string
): string | null {
  const slotId = parseBaseSlotIdFromToken(token);
  if (!slotId) return null;
  const targetIdx = tokenIndexForSlotOccurrence(token, slotId);
  let seen = 0;
  for (const m of snap.mappings) {
    if (m.slot_id !== slotId) continue;
    if (seen === targetIdx) return m.surface.trim() || null;
    seen += 1;
  }
  const first = snap.mappings.find((m) => m.slot_id === slotId);
  return first?.surface.trim() || null;
}
