/**
 * Serializzazione JSON deterministica (chiavi oggetto ordinate) per confronti e audit.
 */

function toStable(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((x) => toStable(x));
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort((a, b) => a.localeCompare(b));
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = toStable(o[k]);
  }
  return out;
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(toStable(value));
}
