/**
 * Riassunto deterministico di un frammento JSON Schema OpenAPI (senza inventare vincoli).
 */

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function effectiveType(schema: Record<string, unknown>): string {
  const t = schema.type;
  if (typeof t === 'string' && t.trim()) return t.trim().toLowerCase();
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return 'string';
  if (isRecord(schema.properties) && Object.keys(schema.properties).length > 0) return 'object';
  if (schema.items !== undefined) return 'array';
  return '';
}

/** Testo positivo: type, format, enum, min/max su items, ecc. */
export function summarizeOpenApiSchemaFragment(schema: unknown): string {
  if (!isRecord(schema)) return '';
  const t = effectiveType(schema);
  if (!t) return '';

  const parts: string[] = [`type ${t}`];

  if (t === 'string') {
    const format = typeof schema.format === 'string' ? schema.format.trim() : '';
    if (format) parts.push(`format ${format}`);
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      const vals = schema.enum.map((x) => String(x)).slice(0, 12);
      const more = schema.enum.length > vals.length ? '…' : '';
      parts.push(`enum: ${vals.join(', ')}${more}`);
    }
    const pattern = typeof schema.pattern === 'string' ? schema.pattern.trim() : '';
    if (pattern) parts.push(`pattern: ${pattern.slice(0, 40)}${pattern.length > 40 ? '…' : ''}`);
  }

  if (t === 'integer' || t === 'number') {
    if (typeof schema.minimum === 'number') parts.push(`minimum ${schema.minimum}`);
    if (typeof schema.maximum === 'number') parts.push(`maximum ${schema.maximum}`);
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      parts.push(`enum: ${schema.enum.map((x) => String(x)).join(', ')}`);
    }
  }

  if (t === 'array' && schema.items !== undefined) {
    const itemSummary = summarizeOpenApiSchemaFragment(schema.items);
    if (itemSummary) parts.push(`items: ${itemSummary}`);
  }

  if (t === 'object' && isRecord(schema.properties)) {
    const keys = Object.keys(schema.properties);
    if (keys.length > 0 && keys.length <= 8) {
      parts.push(`properties: ${keys.join(', ')}`);
    } else if (keys.length > 8) {
      parts.push(`properties: ${keys.length} campi`);
    }
  }

  return parts.join(', ');
}
