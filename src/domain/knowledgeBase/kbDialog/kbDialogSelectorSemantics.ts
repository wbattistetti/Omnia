/**
 * Semantica valori selettore KB: vuoto vs significativo, acceptance da metadati riga.
 */

import { isEmptySelectorCellValue, slugifySelectorColumnId } from '../kbSelectorSpec';
import type { SelectorColumnSpec } from '../kbSelectorSpec';

const EXAM_EMPTY = new Set(['', 'nessuno', 'none', 'no', '-']);

export type SelectorAcceptanceWhen = {
  metadataColumnId: string;
  metadataValue: string;
};

/** True se il valore non richiede disclosure (cella vuota / nessuno esame). */
export function isEmptySelectorValue(columnId: string, value: string): boolean {
  const v = String(value ?? '').trim();
  if (!v || isEmptySelectorCellValue(v)) return true;
  const norm = v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  const col = slugifySelectorColumnId(columnId);
  if (col.includes('esame') && !col.includes('obbligatorio')) {
    return EXAM_EMPTY.has(norm) || norm.startsWith('non_');
  }
  return false;
}

export function computeInformKey(
  bindingWhen: Readonly<Record<string, string>>,
  colId: string,
  value: string
): string {
  const prefix = Object.keys(bindingWhen)
    .sort()
    .map((k) => `${k}=${bindingWhen[k]}`)
    .join('|');
  return `${prefix}::${colId}::${value}`.toLowerCase();
}

function rowCellByColumnId(
  row: readonly string[],
  headers: readonly string[],
  columnId: string
): string {
  const target = slugifySelectorColumnId(columnId);
  const idx = headers.findIndex((h) => slugifySelectorColumnId(String(h ?? '')) === target);
  if (idx < 0) return '';
  return String(row[idx] ?? '').trim();
}

/** Acceptance da metadati riga (acceptanceWhen) o override UC. */
export function resolveRequiresAcceptance(params: {
  col: SelectorColumnSpec;
  matchedRow: readonly string[] | null | undefined;
  headers: readonly string[];
  metaRequiresAcceptance?: boolean;
}): boolean {
  if (params.metaRequiresAcceptance === true) return true;
  const rules = params.col.acceptanceWhen ?? [];
  if (!params.matchedRow || rules.length === 0) return false;
  for (const rule of rules) {
    const cell = rowCellByColumnId(params.matchedRow, params.headers, rule.metadataColumnId);
    if (
      cell &&
      cell.toLowerCase() === String(rule.metadataValue ?? '').trim().toLowerCase()
    ) {
      return true;
    }
  }
  return false;
}

export type InformTransitionKind = 'disclosure' | 'de_disclosure' | 'transition';

/** Determina tipo messaggio inform confrontando valore precedente e nuovo. */
export function resolveInformTransitionKind(
  prevValue: string | undefined,
  nextValue: string | undefined
): InformTransitionKind | null {
  const prevEmpty = !prevValue || isEmptySelectorValue('', prevValue);
  const nextEmpty = !nextValue || isEmptySelectorValue('', nextValue);
  if (nextEmpty && !prevEmpty) return 'de_disclosure';
  if (!nextEmpty && !prevEmpty && prevValue!.toLowerCase() !== nextValue!.toLowerCase()) {
    return 'transition';
  }
  if (!nextEmpty && prevEmpty) return 'disclosure';
  if (!nextEmpty && prevValue && prevValue.toLowerCase() === nextValue!.toLowerCase()) return null;
  return null;
}
