/**
 * Deriva lo `slot_id` base da un nome token nella frase compilata (`data2` → `data`).
 */

import { normalizeSlotId } from '@domain/useCaseBundle/projectSlotLexicon';

export function parseBaseSlotIdFromToken(token: string): string {
  const t = token.trim().toLowerCase();
  if (!t) return '';
  const mUnderscore = /^([a-z]+)_(\d+)$/.exec(t);
  if (mUnderscore) return normalizeSlotId(mUnderscore[1]!);
  const m = /^([a-z]+)(\d+)$/.exec(t);
  if (m) return normalizeSlotId(m[1]!);
  const mPrefix = /^([a-z]+)_/.exec(t);
  if (mPrefix) return normalizeSlotId(mPrefix[1]!);
  return normalizeSlotId(t);
}
