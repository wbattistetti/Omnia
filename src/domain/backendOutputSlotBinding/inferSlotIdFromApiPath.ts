/**
 * Euristica deterministica: path RECEIVE OpenAPI → `slot_id` dinamico (snake_case dal path).
 */

import { isUnclassifiedSlotId, isValidSlotId, UNCLASSIFIED_SLOT_ID } from '@domain/useCaseBundle/projectSlotLexicon';

/** Segmento path normalizzato (ultima parte o intero path lowercased). */
function pathHaystack(apiPath: string): string {
  return apiPath.trim().toLowerCase().replace(/\[(\d+|\w+)\]/g, '[]');
}

const SKIP_LEAF = new Set([
  'slots',
  'summary',
  'done',
  'window',
  'items',
  'results',
  'data',
  'response',
  'body',
]);

/**
 * Deriva uno `slot_id` leggibile dall'ultimo segmento significativo del path RECEIVE.
 */
export function inferSlotIdFromApiPath(apiPath: string): string | undefined {
  const p = pathHaystack(apiPath);
  if (!p) return undefined;

  const segments = p.split(/[.[\]]+/).map((s) => s.trim()).filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!;
    if (SKIP_LEAF.has(seg) || /^\d+$/.test(seg)) continue;
    const slotId = seg
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
    if (isValidSlotId(slotId) && !isUnclassifiedSlotId(slotId)) return slotId;
  }

  const fallback = segments
    .filter((s) => !SKIP_LEAF.has(s))
    .slice(-2)
    .join('_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (isValidSlotId(fallback) && !isUnclassifiedSlotId(fallback)) return fallback;
  return undefined;
}

export function inferFormatForSlotId(slotId: string): string | undefined {
  const s = slotId.toLowerCase();
  if (s.includes('data') || s.includes('date') || s.includes('giorno')) return 'YYYY-MM-DD';
  if (s.includes('ora') || s.includes('time') || s.includes('orario')) return 'HH:mm';
  return undefined;
}

export function isClassifiedSlotId(slotId: string): boolean {
  const s = slotId.trim().toLowerCase();
  return Boolean(s) && s !== UNCLASSIFIED_SLOT_ID && isValidSlotId(s);
}
