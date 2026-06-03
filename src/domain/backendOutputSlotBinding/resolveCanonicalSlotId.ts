/**
 * Risolve token compilati verso `slot_id` dinamici (nessun vocabolario core fisso).
 */

import { isUnclassifiedSlotId, isValidSlotId, normalizeSlotId } from '@domain/useCaseBundle/projectSlotLexicon';
import { parseBaseSlotIdFromToken } from './parseTokenSlotId';

/**
 * Risolve lo `slot_id` usato per contratti e validazione compile.
 */
export function resolveCanonicalSlotIdFromToken(token: string): string {
  const base = parseBaseSlotIdFromToken(token);
  if (!base || isUnclassifiedSlotId(base)) return '';
  if (!isValidSlotId(base)) return '';
  return base;
}

export function isResolvableCanonicalSlotId(slotId: string): boolean {
  const s = normalizeSlotId(slotId);
  return Boolean(s) && !isUnclassifiedSlotId(s) && isValidSlotId(s);
}

/**
 * Normalizza `slot_id` proposto dall'IA o dal designer.
 */
export function normalizeProposalSlotId(raw: string): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || !isValidSlotId(s) || isUnclassifiedSlotId(s)) return null;
  return s;
}
