'use strict';

/**
 * Converte stringhe in primitivi JSON (mock/SEND). **Mantenere allineato** a
 * `src/utils/json/coerceJsonPrimitiveFromString.ts`.
 *
 * @param {unknown} raw
 * @returns {unknown}
 */
function coerceJsonPrimitiveFromString(raw) {
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
      return JSON.parse(t);
    } catch {
      return raw;
    }
  }
  return raw;
}

module.exports = {
  coerceJsonPrimitiveFromString,
};
