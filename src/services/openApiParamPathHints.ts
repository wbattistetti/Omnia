/**
 * Hint OpenAPI per parametro (path dotted = wireKey interno): descrizione, formato, esempio.
 */

import type { OpenApiInputUiKind } from './openApiBackendCallSpec';
import { resolveRef } from './openApiBackendCallSpec';

export type OpenApiParamPathHint = {
  description?: string;
  example?: string;
  type?: string;
  format?: string;
  enum?: string[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function stringifyExample(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    return t || undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    const s = JSON.stringify(value);
    if (!s || s.length > 240) return s.slice(0, 237) + '…';
    return s;
  } catch {
    return undefined;
  }
}

function hintFromPropertySchema(
  root: Record<string, unknown>,
  propSchema: unknown,
  refStack: Set<string>
): OpenApiParamPathHint | undefined {
  if (!isRecord(propSchema)) return undefined;
  let cur: unknown = propSchema;
  for (let depth = 0; depth < 16; depth++) {
    if (!isRecord(cur)) break;
    if (typeof cur.$ref === 'string') {
      const ref = cur.$ref;
      if (refStack.has(ref)) break;
      refStack.add(ref);
      try {
        cur = resolveRef(root, ref);
      } finally {
        refStack.delete(ref);
      }
      continue;
    }
    const description =
      typeof cur.description === 'string' && cur.description.trim()
        ? cur.description.trim()
        : undefined;
    const type = typeof cur.type === 'string' ? cur.type.trim() : undefined;
    const format = typeof cur.format === 'string' ? cur.format.trim() : undefined;
    const example = stringifyExample(cur.example);
    const enumVals = Array.isArray(cur.enum)
      ? cur.enum
          .map((v) => (v === null || v === undefined ? '' : String(v).trim()))
          .filter(Boolean)
      : undefined;
    if (description || example || type || format || enumVals?.length) {
      return {
        ...(description ? { description } : {}),
        ...(example ? { example } : {}),
        ...(type ? { type } : {}),
        ...(format ? { format } : {}),
        ...(enumVals?.length ? { enum: enumVals } : {}),
      };
    }
    break;
  }
  return undefined;
}

/**
 * Raccoglie hint per ogni path dotted (es. `agenda`, `agenda.start`, `constraints.maxDays`).
 */
export function schemaPropertyParamHintsByPath(
  root: Record<string, unknown>,
  schema: unknown
): Record<string, OpenApiParamPathHint> {
  const out: Record<string, OpenApiParamPathHint> = {};

  function walk(s: unknown, rs: Set<string>, pathPrefix: string): void {
    if (!isRecord(s)) return;
    if (typeof s.$ref === 'string') {
      const ref = s.$ref;
      if (rs.has(ref)) return;
      rs.add(ref);
      try {
        walk(resolveRef(root, ref), rs, pathPrefix);
      } finally {
        rs.delete(ref);
      }
      return;
    }
    if (Array.isArray(s.allOf)) {
      for (const sub of s.allOf) walk(sub, rs, pathPrefix);
      return;
    }
    if (Array.isArray(s.oneOf)) {
      for (const sub of s.oneOf) walk(sub, rs, pathPrefix);
      return;
    }
    if (Array.isArray(s.anyOf)) {
      for (const sub of s.anyOf) walk(sub, rs, pathPrefix);
      return;
    }
    if (!isRecord(s.properties)) return;

    const props = s.properties as Record<string, unknown>;
    for (const [key, propSchema] of Object.entries(props)) {
      const segment = key.trim();
      if (!segment) continue;
      const path = pathPrefix ? `${pathPrefix}.${segment}` : segment;
      const hint = hintFromPropertySchema(root, propSchema, new Set(rs));
      if (hint) out[path] = hint;
      walk(propSchema, rs, path);
    }
  }

  walk(schema, new Set(), '');
  return out;
}

export function lookupOpenApiParamPathHint(
  hintsByPath: Record<string, OpenApiParamPathHint> | undefined,
  wireKey: string,
  apiField: string
): OpenApiParamPathHint | undefined {
  if (!hintsByPath) return undefined;
  const w = wireKey.trim();
  const a = apiField.trim();
  if (w && hintsByPath[w]) return hintsByPath[w];
  if (a && hintsByPath[a]) return hintsByPath[a];
  if (w.includes('.')) {
    const leaf = w.split('.').pop();
    if (leaf && hintsByPath[leaf]) return hintsByPath[leaf];
  }
  return undefined;
}

/** Etichetta breve tipo/formato da mostrare accanto al nome parametro. */
export function openApiParamFormatLabel(hint: OpenApiParamPathHint | undefined): string | undefined {
  if (!hint) return undefined;
  const type = hint.type?.trim();
  const format = hint.format?.trim();
  if (type && format && type.toLowerCase() !== format.toLowerCase()) {
    return `${type} · ${format}`;
  }
  return format || type || undefined;
}

const UI_KIND_LABELS: Partial<Record<OpenApiInputUiKind, string>> = {
  number: 'numero',
  boolean: 'booleano',
  date: 'data (YYYY-MM-DD)',
  time: 'ora',
  'datetime-local': 'data e ora',
  uri: 'URL',
  enum: 'valore da elenco',
};

/** Tooltip per la cella valore (variabile / costante). */
export function buildOpenApiValueFieldTooltip(params: {
  hint?: OpenApiParamPathHint;
  uiKind?: OpenApiInputUiKind;
  enumValues?: string[];
  isEmpty?: boolean;
}): string {
  const parts: string[] = [];
  const formatLabel = openApiParamFormatLabel(params.hint);
  if (formatLabel) parts.push(`Formato: ${formatLabel}`);
  if (params.uiKind && UI_KIND_LABELS[params.uiKind]) {
    parts.push(UI_KIND_LABELS[params.uiKind]!);
  }
  const enums =
    params.enumValues && params.enumValues.length > 0
      ? params.enumValues
      : params.hint?.enum;
  if (enums?.length) {
    const preview = enums.slice(0, 12).join(', ');
    parts.push(
      enums.length > 12 ? `Valori ammessi: ${preview}, …` : `Valori ammessi: ${preview}`
    );
  }
  if (params.hint?.example) {
    parts.push(`Esempio: ${params.hint.example}`);
  }
  if (parts.length === 0) {
    return params.isEmpty
      ? 'Valore mancante: collega una variabile o immetti un valore costante.'
      : 'Collega una variabile di flusso o immetti un valore costante.';
  }
  if (params.isEmpty) {
    parts.push('Valore mancante: collega una variabile o immetti un valore costante.');
  }
  return parts.join('\n');
}
