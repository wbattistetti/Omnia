/**
 * Stato «riga compilata» per mock table: tutti gli input attivi hanno un valore non vuoto.
 */

import type { BackendMockTableRow } from './backendTestRowTypes';

/** True se la cella input è considerata compilata (non nulla, non solo spazi, non placeholder “empty”). */
export function isBackendMockInputCellFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  const s = String(value).trim();
  if (s === '') return false;
  if (s.toLowerCase() === 'empty') return false;
  return true;
}

/**
 * True se la riga ha tutti gli input richiesti compilati.
 * @param activeInputInternalNames Nomi colonna input attivi (stessa convenzione di `row.inputs`).
 * @param fallbackByInternalName Valori «striscia» endpoint (internalName); la cella riga ha priorità sul fallback.
 */
export function isBackendMockRowInputsFilledForColumns(
  row: BackendMockTableRow,
  activeInputInternalNames: readonly string[],
  fallbackByInternalName?: Readonly<Record<string, string>>
): boolean {
  if (activeInputInternalNames.length === 0) return true;
  return activeInputInternalNames.every((name) => {
    if (isBackendMockInputCellFilled(row.inputs?.[name])) return true;
    if (fallbackByInternalName && isBackendMockInputCellFilled(fallbackByInternalName[name])) return true;
    return false;
  });
}
