/**
 * Converte stringa cella mock in valore JSON (numeri, boolean, oggetti/array JSON).
 * Usa {@link coerceJsonPrimitiveFromString} (allineato al backend Express).
 */

import { coerceJsonPrimitiveFromString } from '../json/coerceJsonPrimitiveFromString';

export function coerceMockCellValue(raw: unknown): unknown {
  return coerceJsonPrimitiveFromString(raw);
}
