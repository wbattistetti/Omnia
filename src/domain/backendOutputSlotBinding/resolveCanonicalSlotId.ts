/**
 * Mappa nomi token / base lessicali verso slot_id canonici (CORE_SLOT_IDS) per binding RECEIVE.
 */

import { CORE_SLOT_IDS, normalizeSlotId } from '@domain/useCaseBundle/projectSlotLexicon';
import { parseBaseSlotIdFromToken } from './parseTokenSlotId';

const CORE_SET = new Set<string>(CORE_SLOT_IDS);

/** Base token (es. `giorno` da `giorno_1`) → slot canonico quando non è già in CORE. */
const TOKEN_BASE_TO_CANONICAL: Readonly<Record<string, string>> = {
  giorno: 'data',
  data: 'data',
  ora: 'orario',
  orario: 'orario',
  time: 'orario',
  slot: 'data',
  window: 'datarelativa',
};

/**
 * Risolve lo slot_id canonico usato per contratti RECEIVE e validazione compile.
 */
export function resolveCanonicalSlotIdFromToken(token: string): string {
  const base = parseBaseSlotIdFromToken(token);
  if (!base) return '';
  if (CORE_SET.has(base)) return base;
  const mapped = TOKEN_BASE_TO_CANONICAL[base];
  if (mapped && CORE_SET.has(mapped)) return mapped;
  const direct = TOKEN_BASE_TO_CANONICAL[token.trim().toLowerCase()];
  if (direct && CORE_SET.has(direct)) return direct;
  return normalizeSlotId(base);
}

export function isResolvableCanonicalSlotId(slotId: string): boolean {
  const s = slotId.trim().toLowerCase();
  return Boolean(s) && CORE_SET.has(s);
}

/**
 * Normalizza slot_id proposto dall'IA o dal lessico (accetta base token → canonico).
 */
export function normalizeProposalSlotId(raw: string): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (CORE_SET.has(s)) return s;
  const fromBase = TOKEN_BASE_TO_CANONICAL[s];
  if (fromBase && CORE_SET.has(fromBase)) return fromBase;
  const fromToken = resolveCanonicalSlotIdFromToken(s);
  if (fromToken && CORE_SET.has(fromToken)) return fromToken;
  const m = /^([a-z]+)_(\d+)$/.exec(s);
  if (m) {
    const mapped = TOKEN_BASE_TO_CANONICAL[m[1]!];
    if (mapped && CORE_SET.has(mapped)) return mapped;
  }
  return null;
}
