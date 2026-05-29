/**
 * Errori bloccanti di “compilazione” schema OpenAPI (SEND/RECEIVE): ref non risolti, tipi/format mancanti.
 * Non inventa vincoli: segnala solo ciò che manca nello spec materializzato dopo Read API.
 */

import { collectRemainingOpenApiRefs } from './openApiSchemaRefValidation';

export type OpenApiCompileValidationInput = {
  /** Frammenti JSON Schema per proprietà SEND (top-level e nested materializzati). */
  jsonSchemasByApiName?: Record<string, Record<string, unknown>>;
  /** Parametri query/path/header senza frammento body. */
  paramUiKindsByApiName?: Record<string, string>;
  paramEnumsByApiName?: Record<string, string[]>;
};

const SPEC_INCOMPLETE_SUFFIX = ' — spec incompleta';

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

function stringHasClosedDomain(schema: Record<string, unknown>): boolean {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return true;
  const format = typeof schema.format === 'string' ? schema.format.trim().toLowerCase() : '';
  if (format) return true;
  const pattern = typeof schema.pattern === 'string' ? schema.pattern.trim() : '';
  if (pattern) return true;
  return false;
}

function validateNode(path: string, schema: unknown): string[] {
  if (!isRecord(schema)) {
    return path ? [`${path}: schema assente${SPEC_INCOMPLETE_SUFFIX}`] : [];
  }

  const t = effectiveType(schema);
  if (!t) {
    return [`${path}: manca type${SPEC_INCOMPLETE_SUFFIX}`];
  }

  if (t === 'string') {
    if (!stringHasClosedDomain(schema)) {
      return [`${path}: string senza format, enum o pattern${SPEC_INCOMPLETE_SUFFIX}`];
    }
    return [];
  }

  if (t === 'boolean' || t === 'number' || t === 'integer') {
    return [];
  }

  if (t === 'array') {
    if (schema.items === undefined) {
      return [`${path}: array senza items${SPEC_INCOMPLETE_SUFFIX}`];
    }
    return validateNode(`${path}[]`, schema.items);
  }

  if (t === 'object') {
    const props = schema.properties;
    if (!isRecord(props) || Object.keys(props).length === 0) {
      return [`${path}: object senza properties${SPEC_INCOMPLETE_SUFFIX}`];
    }
    const errors: string[] = [];
    for (const [key, child] of Object.entries(props)) {
      const childPath = path ? `${path}.${key}` : key;
      errors.push(...validateNode(childPath, child));
    }
    return errors;
  }

  return [`${path}: type "${t}" non supportato per compilazione${SPEC_INCOMPLETE_SUFFIX}`];
}

function validateParamWithoutFragment(
  apiName: string,
  kind: string,
  enums: Record<string, string[]>
): string[] {
  const k = kind.trim().toLowerCase();
  if (k === 'enum') {
    const vals = enums[apiName];
    if (!vals || vals.length === 0) {
      return [`${apiName}: enum dichiarato senza valori${SPEC_INCOMPLETE_SUFFIX}`];
    }
    return [];
  }
  if (k === 'text') {
    return [`${apiName}: string senza format, enum o pattern${SPEC_INCOMPLETE_SUFFIX}`];
  }
  if (k === 'date' || k === 'time' || k === 'datetime-local' || k === 'uri' || k === 'number' || k === 'boolean') {
    return [];
  }
  return [];
}

/**
 * Elenco messaggi errore (ordinato, senza duplicati) per UI Monaco e handoff al team backend.
 */
export function collectOpenApiCompileErrors(input: OpenApiCompileValidationInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (msg: string) => {
    const m = msg.trim();
    if (!m || seen.has(m)) return;
    seen.add(m);
    out.push(m);
  };

  const schemas = input.jsonSchemasByApiName ?? {};
  for (const [apiName, fragment] of Object.entries(schemas)) {
    const name = apiName.trim();
    if (!name) continue;
    for (const err of collectRemainingOpenApiRefs(fragment, name)) push(err);
    for (const err of validateNode(name, fragment)) push(err);
  }

  const kinds = input.paramUiKindsByApiName ?? {};
  const enums = input.paramEnumsByApiName ?? {};
  const schemaKeys = new Set(Object.keys(schemas).map((k) => k.trim()));
  for (const [apiName, kind] of Object.entries(kinds)) {
    const name = apiName.trim();
    if (!name || schemaKeys.has(name)) continue;
    if (typeof kind !== 'string') continue;
    for (const err of validateParamWithoutFragment(name, kind, enums)) push(err);
  }

  return out.sort((a, b) => a.localeCompare(b));
}

/** Testo unico per Monaco (read-only). */
export function formatOpenApiCompileErrorsReport(errors: readonly string[]): string {
  if (!errors.length) return '';
  const lines = [
    'Spec incompleta: impossibile compilare constraints',
    '',
    ...errors,
  ];
  return lines.join('\n');
}
