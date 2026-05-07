/**
 * Converte stringhe in primitivi JSON per righe mock/SEND (numeri, boolean, oggetti/array JSON).
 * Allineato a `backend/utils/jsonPrimitiveCoerce.js` per coerenza Express ↔ Omnia.
 */

export function coerceJsonPrimitiveFromString(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw !== 'string') return raw;
  const t = raw.trim();
  if (t === '') return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t !== '0' && /^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}
