/**
 * Deriva lo `slot_id` base da un nome token nella frase compilata.
 */

import { isValidSlotId, normalizeSlotId } from '@domain/useCaseBundle/projectSlotLexicon';

export function parseBaseSlotIdFromToken(token: string): string {
  const t = token.trim().toLowerCase();
  if (!t) return '';

  /** Suffisso numerico variante: `medico_richiesto_1` → `medico_richiesto`. */
  const numbered = /^(.+)_(\d+)$/.exec(t);
  if (numbered) {
    const base = normalizeSlotId(numbered[1]!);
    if (isValidSlotId(base)) return base;
  }

  const compactNum = /^([a-z]+)(\d+)$/.exec(t);
  if (compactNum) {
    const base = normalizeSlotId(compactNum[1]!);
    if (isValidSlotId(base)) return base;
  }

  const direct = normalizeSlotId(t);
  if (isValidSlotId(direct)) return direct;
  return '';
}
