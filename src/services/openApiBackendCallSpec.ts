/**
 * Fetches OpenAPI/Swagger JSON and extracts request/response field names for a Backend Call operation.
 * Risoluzione `$ref` inline (#/components/…) per schema tool, prompt e validazione compile.
 */

import type { OpenApiSendBindingRules } from '../domain/backendCatalog/catalogTypes';
import {
  schemaPropertyParamHintsByPath,
  type OpenApiParamPathHint,
} from './openApiParamPathHints';

/** Kind per `input` HTML5 nelle celle mock / SEND (chiave = nome campo API). */
export type OpenApiInputUiKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'uri'
  | 'enum'
  /** Corpo/query con `type: object` o `$ref` a schema oggetto — JSON Schema per tool ConvAI. */
  | 'object';

export type OpenApiOperationFields = {
  /** OpenAPI `operationId` for the resolved path/method, when present. */
  operationId?: string;
  /** OpenAPI operation `summary` (short human label). */
  operationSummary?: string;
  /** OpenAPI operation `description` (longer prose). */
  operationDescription?: string;
  /** query, path, header parameter names */
  requestParamNames: string[];
  /** Top-level JSON body property names (POST/PUT/PATCH body object) */
  requestBodyPropertyNames: string[];
  /** Top-level JSON response property names (2xx, application/json) */
  responsePropertyNames: string[];
  /** OpenAPI `description` per nome parametro/property (chiave = nome API). */
  inputDescriptionsByApiName: Record<string, string>;
  /** OpenAPI `description` per proprietà risposta top-level. */
  outputDescriptionsByApiName: Record<string, string>;
  /** Tipo UI input (date/time/number/uri/enum/…) dedotto da schema OpenAPI. */
  inputUiKindByApiName: Record<string, OpenApiInputUiKind>;
  /** Valori `enum` JSON Schema per parametro/property (solo quando dichiarati nello spec). */
  inputEnumByApiName: Record<string, string[]>;
  /** `x-omnia.sendBinding` sullo schema body (obbligatorietà compile SEND). */
  sendBindingRules?: OpenApiSendBindingRules;
  /** Per proprietà body: `x-omnia.bindingPhase` / `x-runtime-mandatory` (runtime vs design). */
  bindingPhaseByApiName?: Record<string, 'design' | 'runtime'>;
  /**
   * Frammenti JSON Schema (inline, `$ref` risolti) per ogni proprietà top-level del body — tool LLM fedeli a OpenAPI.
   */
  inputJsonSchemaByApiName?: Record<string, Record<string, unknown>>;
  /** Frammenti JSON Schema per proprietà top-level risposta 2xx. */
  outputJsonSchemaByApiName?: Record<string, Record<string, unknown>>;
  /** Hint per path dotted (wireKey interno): descrizione, esempio, tipo/formato. */
  inputParamHintsByPath?: Record<string, import('./openApiParamPathHints').OpenApiParamPathHint>;
  outputParamHintsByPath?: Record<string, import('./openApiParamPathHints').OpenApiParamPathHint>;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function resolveRef(root: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/');
  let cur: unknown = root;
  for (const p of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

const MAX_TOOL_SCHEMA_DEPTH = 28;
const MAX_TOOL_SCHEMA_PROPERTIES = 120;

/**
 * Inline di uno schema JSON Schema per ConvAI: risolve `$ref`, limita profondità/dimensione (nessun ciclo serializzato).
 */
export function materializeJsonSchemaFragmentForTool(
  root: Record<string, unknown>,
  schema: unknown,
  refStack: Set<string>,
  depth: number
): Record<string, unknown> {
  if (depth > MAX_TOOL_SCHEMA_DEPTH) {
    return { description: 'Limite profondità schema OpenAPI (frammento troncato).' };
  }
  if (!isRecord(schema)) {
    return {};
  }
  if (typeof schema.$ref === 'string') {
    const ref = schema.$ref;
    if (refStack.has(ref)) {
      return { description: 'Riferimento circolare nello schema OpenAPI.' };
    }
    refStack.add(ref);
    try {
      const resolved = resolveRef(root, ref);
      if (resolved === undefined || resolved === null) {
        return {
          description: `Spec incompleta: ref non risolto (${ref})`,
          'x-omnia-unresolvedRef': ref,
        };
      }
      return materializeJsonSchemaFragmentForTool(root, resolved, refStack, depth + 1);
    } finally {
      refStack.delete(ref);
    }
  }
  if (Array.isArray(schema.allOf)) {
    if (schema.allOf.length === 1) {
      return materializeJsonSchemaFragmentForTool(root, schema.allOf[0], refStack, depth);
    }
    const propsAcc: Record<string, unknown> = {};
    let desc = '';
    let type = '';
    for (const sub of schema.allOf) {
      const m = materializeJsonSchemaFragmentForTool(root, sub, new Set(refStack), depth + 1);
      if (typeof m.description === 'string' && m.description && !desc) desc = m.description;
      if (typeof m.type === 'string' && m.type && !type) type = m.type;
      if (isRecord(m.properties)) {
        for (const [pk, pv] of Object.entries(m.properties as Record<string, unknown>)) {
          propsAcc[pk] = materializeJsonSchemaFragmentForTool(
            root,
            pv,
            new Set(refStack),
            depth + 1
          );
        }
      }
    }
    const out: Record<string, unknown> = {};
    if (type) out.type = type;
    if (desc) out.description = desc;
    if (Object.keys(propsAcc).length > 0) out.properties = propsAcc;
    return out;
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return materializeJsonSchemaFragmentForTool(root, schema.oneOf[0], refStack, depth);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return materializeJsonSchemaFragmentForTool(root, schema.anyOf[0], refStack, depth);
  }

  const out: Record<string, unknown> = {};
  for (const key of [
    'type',
    'format',
    'title',
    'description',
    'default',
    'const',
    'enum',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minLength',
    'maxLength',
    'pattern',
    'minItems',
    'maxItems',
    'uniqueItems',
    'additionalProperties',
  ]) {
    if (schema[key] !== undefined) out[key] = schema[key];
  }

  const tRaw = schema.type;
  const t = typeof tRaw === 'string' ? tRaw.toLowerCase() : '';
  const propsObj = isRecord(schema.properties) ? schema.properties : undefined;

  if ((t === 'object' || (!tRaw && propsObj)) && propsObj) {
    out.type = 'object';
    const props: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(propsObj)) {
      if (n++ >= MAX_TOOL_SCHEMA_PROPERTIES) break;
      props[k] = materializeJsonSchemaFragmentForTool(root, v, new Set(refStack), depth + 1);
    }
    out.properties = props;
    if (Array.isArray(schema.required)) out.required = schema.required;
    return out;
  }

  if (t === 'array' || schema.items !== undefined) {
    out.type = 'array';
    out.items = materializeJsonSchemaFragmentForTool(root, schema.items, new Set(refStack), depth + 1);
    return out;
  }

  return out;
}

/**
 * Per ogni property top-level del body: frammento JSON Schema materializzato (composizioni + `$ref` come {@link schemaPropertyInputKinds}).
 */
export function schemaPropertyJsonSchemaFragmentsForTool(
  root: Record<string, unknown>,
  schema: unknown
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  function walk(s: unknown, rs: Set<string>): void {
    if (!isRecord(s)) return;
    if (typeof s.$ref === 'string') {
      if (rs.has(s.$ref)) return;
      rs.add(s.$ref);
      try {
        walk(resolveRef(root, s.$ref), rs);
      } finally {
        rs.delete(s.$ref);
      }
      return;
    }
    if (Array.isArray(s.allOf)) {
      for (const sub of s.allOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.oneOf)) {
      for (const sub of s.oneOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.anyOf)) {
      for (const sub of s.anyOf) walk(sub, rs);
      return;
    }
    if (isRecord(s.properties)) {
      const props = s.properties as Record<string, unknown>;
      for (const [key, propSchema] of Object.entries(props)) {
        const k = key.trim();
        if (!k || out[k]) continue;
        out[k] = materializeJsonSchemaFragmentForTool(root, propSchema, new Set(), 0);
      }
    }
  }
  walk(schema, new Set());
  return out;
}

function mergeJsonSchemaFragmentMaps(
  target: Record<string, Record<string, unknown>>,
  source: Record<string, Record<string, unknown>>
): void {
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key || target[key]) continue;
    target[key] = v;
  }
}

/**
 * Chiavi proprietà top-level di uno schema JSON (body/risposta OpenAPI).
 * Espande `allOf` / `oneOf` / `anyOf` e risolve `$ref` con guardia cicli.
 */
function schemaPropertyKeys(root: Record<string, unknown>, schema: unknown, refStack?: Set<string>): string[] {
  const rs = refStack ?? new Set<string>();
  if (!isRecord(schema)) return [];
  if (typeof schema.$ref === 'string') {
    const ref = schema.$ref;
    if (rs.has(ref)) return [];
    rs.add(ref);
    try {
      const resolved = resolveRef(root, ref);
      return schemaPropertyKeys(root, resolved, rs);
    } finally {
      rs.delete(ref);
    }
  }
  if (Array.isArray(schema.allOf)) {
    const acc: string[] = [];
    for (const sub of schema.allOf) {
      acc.push(...schemaPropertyKeys(root, sub, rs));
    }
    return mergeUnique(acc, []);
  }
  if (Array.isArray(schema.oneOf)) {
    const acc: string[] = [];
    for (const sub of schema.oneOf) {
      acc.push(...schemaPropertyKeys(root, sub, rs));
    }
    return mergeUnique(acc, []);
  }
  if (Array.isArray(schema.anyOf)) {
    const acc: string[] = [];
    for (const sub of schema.anyOf) {
      acc.push(...schemaPropertyKeys(root, sub, rs));
    }
    return mergeUnique(acc, []);
  }
  if (schema.type === 'object' && isRecord(schema.properties)) {
    return Object.keys(schema.properties as Record<string, unknown>);
  }
  if (isRecord(schema.properties)) {
    const pk = Object.keys(schema.properties as Record<string, unknown>);
    if (pk.length > 0) return pk;
  }
  return [];
}

/** Top-level property descriptions from a JSON Schema object (risolve $ref, composizioni). */
export function schemaPropertyDescriptions(root: Record<string, unknown>, schema: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  function walk(s: unknown, rs: Set<string>): void {
    if (!isRecord(s)) return;
    if (typeof s.$ref === 'string') {
      if (rs.has(s.$ref)) return;
      rs.add(s.$ref);
      try {
        walk(resolveRef(root, s.$ref), rs);
      } finally {
        rs.delete(s.$ref);
      }
      return;
    }
    if (Array.isArray(s.allOf)) {
      for (const sub of s.allOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.oneOf)) {
      for (const sub of s.oneOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.anyOf)) {
      for (const sub of s.anyOf) walk(sub, rs);
      return;
    }
    if (isRecord(s.properties)) {
      const props = s.properties as Record<string, unknown>;
      for (const [key, propSchema] of Object.entries(props)) {
        if (!isRecord(propSchema)) continue;
        const d = propSchema.description;
        if (typeof d === 'string' && d.trim()) {
          const k = key.trim();
          if (k && !out[k]) out[k] = d.trim();
        }
      }
    }
  }
  walk(schema, new Set());
  return out;
}

/** bindingPhase per campo body (`x-omnia.bindingPhase` o `x-runtime-mandatory`). */
export function schemaPropertyBindingPhases(root: Record<string, unknown>, schema: unknown): Record<string, 'design' | 'runtime'> {
  const out: Record<string, 'design' | 'runtime'> = {};
  function walk(s: unknown, rs: Set<string>): void {
    if (!isRecord(s)) return;
    if (typeof s.$ref === 'string') {
      if (rs.has(s.$ref)) return;
      rs.add(s.$ref);
      try {
        walk(resolveRef(root, s.$ref), rs);
      } finally {
        rs.delete(s.$ref);
      }
      return;
    }
    if (Array.isArray(s.allOf)) {
      for (const sub of s.allOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.oneOf)) {
      for (const sub of s.oneOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.anyOf)) {
      for (const sub of s.anyOf) walk(sub, rs);
      return;
    }
    if (isRecord(s.properties)) {
      const props = s.properties as Record<string, unknown>;
      for (const [key, propSchema] of Object.entries(props)) {
        if (!isRecord(propSchema)) continue;
        const k = key.trim();
        if (!k || out[k]) continue;
        const xo = propSchema['x-omnia'];
        if (isRecord(xo)) {
          const bp = xo.bindingPhase;
          if (bp === 'runtime' || bp === 'design') {
            out[k] = bp;
            continue;
          }
        }
        if (propSchema['x-runtime-mandatory'] === true) {
          out[k] = 'runtime';
        }
      }
    }
  }
  walk(schema, new Set());
  return out;
}

function mergeBindingPhaseMaps(
  target: Record<string, 'design' | 'runtime'>,
  source: Record<string, 'design' | 'runtime'>
): void {
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key || target[key]) continue;
    target[key] = v;
  }
}

function mergeDescriptionMaps(target: Record<string, string>, source: Record<string, string>): void {
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key || target[key]) continue;
    const t = v.trim();
    if (t) target[key] = t;
  }
}

function mergeParamHintMaps(
  target: Record<string, OpenApiParamPathHint>,
  source: Record<string, OpenApiParamPathHint>
): void {
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key) continue;
    target[key] = { ...(target[key] ?? {}), ...v };
  }
}

function mergeUiKindMaps(target: Record<string, OpenApiInputUiKind>, source: Record<string, OpenApiInputUiKind>): void {
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key || target[key]) continue;
    target[key] = v;
  }
}

function mergeEnumMaps(target: Record<string, string[]>, source: Record<string, string[]>): void {
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key || (target[key]?.length ?? 0) > 0) continue;
    if (Array.isArray(v) && v.length > 0) target[key] = [...v];
  }
}

function setFirstEnum(target: Record<string, string[]>, key: string, values: string[]): void {
  const k = key.trim();
  if (!k || (target[k]?.length ?? 0) > 0) return;
  if (values.length > 0) target[k] = [...values];
}

function parseRequireOneOfSetsFromXomnia(
  raw: unknown
): OpenApiSendBindingRules['requireOneOfSets'] {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<OpenApiSendBindingRules['requireOneOfSets']> = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = String(item.id ?? '').trim();
    if (!id) continue;
    const labelRaw = item.label;
    const label = typeof labelRaw === 'string' && labelRaw.trim() ? labelRaw.trim() : undefined;
    const altsRaw = item.alternatives;
    const alternatives: Array<{ allApiParams: string[] }> = [];
    if (Array.isArray(altsRaw)) {
      for (const a of altsRaw) {
        if (!isRecord(a)) continue;
        const p = a.allApiParams;
        if (!Array.isArray(p)) continue;
        const allApiParams = p.map((x) => String(x ?? '').trim()).filter(Boolean);
        if (allApiParams.length > 0) alternatives.push({ allApiParams });
      }
    }
    if (alternatives.length > 0) out.push({ id, ...(label ? { label } : {}), alternatives });
  }
  return out.length > 0 ? out : undefined;
}

function parseSendBindingRecord(sb: Record<string, unknown>): OpenApiSendBindingRules | undefined {
  const opt = sb.optionalApiParams;
  const optionalApiParams = Array.isArray(opt)
    ? opt.map((x) => String(x ?? '').trim()).filter(Boolean)
    : [];
  const dtr = sb.designTimeRequiredApiParams;
  const designTimeRequiredApiParams = Array.isArray(dtr)
    ? dtr.map((x) => String(x ?? '').trim()).filter(Boolean)
    : [];
  const requireOneOfSets = parseRequireOneOfSetsFromXomnia(sb.requireOneOfSets);
  const out: OpenApiSendBindingRules = { optionalApiParams, requireOneOfSets };
  if (designTimeRequiredApiParams.length > 0) out.designTimeRequiredApiParams = designTimeRequiredApiParams;
  return out;
}

/**
 * Legge `x-omnia.sendBinding` sullo schema body (risolve `$ref` fino allo schema con estensioni).
 */
export function extractOmniaSendBindingRules(
  root: Record<string, unknown>,
  schema: unknown
): OpenApiSendBindingRules | undefined {
  let cur: unknown = schema;
  const rs = new Set<string>();
  for (let depth = 0; depth < 40; depth++) {
    if (!isRecord(cur)) return undefined;
    if (typeof cur.$ref === 'string') {
      const ref = cur.$ref;
      if (rs.has(ref)) return undefined;
      rs.add(ref);
      cur = resolveRef(root, ref);
      continue;
    }
    const x = cur['x-omnia'];
    if (isRecord(x)) {
      const sb = x.sendBinding;
      if (isRecord(sb)) {
        return parseSendBindingRecord(sb);
      }
    }
    return undefined;
  }
  return undefined;
}

/**
 * Enum della proprietà (risolve $ref / composizioni).
 */
function enumValuesFromPropertySchema(
  root: Record<string, unknown>,
  propSchema: unknown,
  refStack?: Set<string>
): string[] | undefined {
  let cur: unknown = propSchema;
  const rs = refStack ?? new Set<string>();
  for (let i = 0; i < 16; i++) {
    if (!isRecord(cur)) return undefined;
    if (typeof cur.$ref === 'string') {
      const ref = cur.$ref;
      if (rs.has(ref)) return undefined;
      rs.add(ref);
      try {
        cur = resolveRef(root, ref);
        continue;
      } finally {
        rs.delete(ref);
      }
    }
    if (Array.isArray(cur.enum) && cur.enum.length > 0) {
      return cur.enum.map((x) => String(x));
    }
    if (Array.isArray(cur.allOf)) {
      for (const sub of cur.allOf) {
        const e = enumValuesFromPropertySchema(root, sub, rs);
        if (e?.length) return e;
      }
      return undefined;
    }
    if (Array.isArray(cur.oneOf)) {
      for (const sub of cur.oneOf) {
        const e = enumValuesFromPropertySchema(root, sub, rs);
        if (e?.length) return e;
      }
      return undefined;
    }
    if (Array.isArray(cur.anyOf)) {
      for (const sub of cur.anyOf) {
        const e = enumValuesFromPropertySchema(root, sub, rs);
        if (e?.length) return e;
      }
      return undefined;
    }
    return undefined;
  }
  return undefined;
}

/** Per ogni property top-level: lista enum se presente nello schema. */
function schemaPropertyEnums(root: Record<string, unknown>, schema: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  function walk(s: unknown, rs: Set<string>): void {
    if (!isRecord(s)) return;
    if (typeof s.$ref === 'string') {
      if (rs.has(s.$ref)) return;
      rs.add(s.$ref);
      try {
        walk(resolveRef(root, s.$ref), rs);
      } finally {
        rs.delete(s.$ref);
      }
      return;
    }
    if (Array.isArray(s.allOf)) {
      for (const sub of s.allOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.oneOf)) {
      for (const sub of s.oneOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.anyOf)) {
      for (const sub of s.anyOf) walk(sub, rs);
      return;
    }
    if (isRecord(s.properties)) {
      const props = s.properties as Record<string, unknown>;
      for (const [key, propSchema] of Object.entries(props)) {
        const k = key.trim();
        if (!k || (out[k]?.length ?? 0) > 0) continue;
        const vals = enumValuesFromPropertySchema(root, propSchema, new Set(rs));
        if (vals?.length) out[k] = vals;
      }
    }
  }
  walk(schema, new Set());
  return out;
}

/** Risolve $ref e mappa `type`/`format`/`enum` JSON Schema → controllo HTML5 / combo. */
export function openApiSchemaToInputUiKind(root: Record<string, unknown>, schema: unknown): OpenApiInputUiKind {
  let cur: unknown = schema;
  for (let i = 0; i < 12; i++) {
    if (!isRecord(cur)) return 'text';
    if (typeof cur.$ref === 'string') {
      cur = resolveRef(root, cur.$ref);
      continue;
    }
    if (Array.isArray(cur.enum) && cur.enum.length > 0) return 'enum';
    const t = String(cur.type || '').toLowerCase();
    const f = typeof cur.format === 'string' ? cur.format.toLowerCase() : '';
    if (t === 'boolean') return 'boolean';
    if (t === 'integer' || t === 'number') return 'number';
    if (t === 'object') return 'object';
    if (t === 'array') return 'text';
    if (!cur.type && isRecord(cur.properties) && Object.keys(cur.properties).length > 0) {
      return 'object';
    }
    if (t === 'string') {
      if (f === 'uri' || f === 'url') return 'uri';
      if (f === 'date') return 'date';
      if (f === 'date-time' || f === 'datetime') return 'datetime-local';
      if (f === 'time' || f === 'partial-time') return 'time';
    }
    return 'text';
  }
  return 'text';
}

/** Per ogni property top-level, kind UI (composizioni + $ref). */
function schemaPropertyInputKinds(root: Record<string, unknown>, schema: unknown): Record<string, OpenApiInputUiKind> {
  const out: Record<string, OpenApiInputUiKind> = {};
  function walk(s: unknown, rs: Set<string>): void {
    if (!isRecord(s)) return;
    if (typeof s.$ref === 'string') {
      if (rs.has(s.$ref)) return;
      rs.add(s.$ref);
      try {
        walk(resolveRef(root, s.$ref), rs);
      } finally {
        rs.delete(s.$ref);
      }
      return;
    }
    if (Array.isArray(s.allOf)) {
      for (const sub of s.allOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.oneOf)) {
      for (const sub of s.oneOf) walk(sub, rs);
      return;
    }
    if (Array.isArray(s.anyOf)) {
      for (const sub of s.anyOf) walk(sub, rs);
      return;
    }
    if (isRecord(s.properties)) {
      const props = s.properties as Record<string, unknown>;
      for (const [key, propSchema] of Object.entries(props)) {
        const k = key.trim();
        if (!k || out[k]) continue;
        out[k] = openApiSchemaToInputUiKind(root, propSchema);
      }
    }
  }
  walk(schema, new Set());
  return out;
}

function setFirstUiKind(
  target: Record<string, OpenApiInputUiKind>,
  key: string,
  root: Record<string, unknown>,
  schema: unknown
): void {
  const k = key.trim();
  if (!k || target[k]) return;
  target[k] = openApiSchemaToInputUiKind(root, schema);
}

function setFirstDescription(target: Record<string, string>, key: string, desc: unknown): void {
  const k = key.trim();
  if (!k || target[k]) return;
  if (typeof desc !== 'string' || !desc.trim()) return;
  target[k] = desc.trim();
}

/** Confronto testi descrizione (locale vs OpenAPI). */
export function normalizeOpenApiDescriptionText(s: string | undefined): string {
  if (!s?.trim()) return '';
  return s.trim().replace(/\s+/g, ' ');
}

/** True se entrambi valorizzati e diversi dopo normalizzazione. */
export function descriptionsDifferFromOpenApi(local: string | undefined, openapi: string | undefined): boolean {
  const a = normalizeOpenApiDescriptionText(local);
  const b = normalizeOpenApiDescriptionText(openapi);
  if (!a || !b) return false;
  return a !== b;
}

function mergeUnique(a: string[], b: string[]): string[] {
  const s = new Set<string>();
  for (const x of a) {
    const t = x.trim();
    if (t) s.add(t);
  }
  for (const x of b) {
    const t = x.trim();
    if (t) s.add(t);
  }
  return [...s];
}

/** Normalize URL pathname for matching OpenAPI paths (no trailing slash except root). */
function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/$/, '') || '/';
}

/**
 * Find OpenAPI path key for a request pathname (exact or template like /users/{id}).
 */
export function matchOpenApiPath(
  paths: Record<string, unknown> | undefined,
  requestPathname: string
): string | null {
  if (!paths || typeof paths !== 'object') return null;
  const norm = normalizePathname(requestPathname);
  if (paths[norm]) return norm;
  if (paths[requestPathname]) return requestPathname;
  for (const p of Object.keys(paths)) {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+');
    try {
      const re = new RegExp(`^${escaped}$`);
      if (re.test(norm)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Abbina un pathname “deploy” (es. Supabase `/functions/v1/.../next-window`) a una chiave
 * OpenAPI relativa (es. `/next-window`) quando il suffisso coincide con un path dello spec.
 * Preferisce la chiave più lunga in caso di più candidati.
 */
export function matchOpenApiPathBySuffix(
  paths: Record<string, unknown> | undefined,
  requestPathname: string
): string | null {
  if (!paths || typeof paths !== 'object') return null;
  const norm = normalizePathname(requestPathname);
  const candidates: string[] = [];
  for (const p of Object.keys(paths)) {
    const pk = normalizePathname(p);
    if (!pk || pk === '/') continue;
    const ends = norm === pk || (pk.startsWith('/') && norm.endsWith(pk));
    if (ends) candidates.push(p);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => normalizePathname(b).length - normalizePathname(a).length);
  return candidates[0] ?? null;
}
function isOpenApiSpecResourcePathname(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (lower.endsWith('.json')) {
    return (
      lower.includes('swagger') ||
      lower.includes('openapi') ||
      lower.includes('api-doc')
    );
  }
  if (lower === '/v3/api-docs' || lower.endsWith('/v3/api-docs')) return true;
  if (lower === '/api-docs' || lower.endsWith('/api-docs')) return true;
  return false;
}

function isDocumentationViewerPathname(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return (
    lower.includes('/redoc') ||
    lower.includes('swagger-ui') ||
    lower.includes('/scalar') ||
    lower.includes('/elements/')
  );
}

/**
 * Path HTTP dell’operazione da usare con matchOpenApiPath.
 * Se l’URL è solo viewer (Redoc) o file swagger.json, ritorna null (non si può dedurre l’operazione).
 */
export function deriveApiRequestPathnameFromEndpointUrl(endpointUrl: string): string | null {
  let mainP: string;
  try {
    mainP = new URL(endpointUrl).pathname || '/';
  } catch {
    return null;
  }

  const mainIsDoc = isDocumentationViewerPathname(mainP);
  const mainIsSpec = isOpenApiSpecResourcePathname(mainP);

  if (!mainIsDoc && !mainIsSpec) {
    return mainP;
  }

  const nested = extractNestedSpecUrlsFromEndpoint(endpointUrl)[0];
  if (nested) {
    try {
      const np = new URL(nested).pathname || '/';
      if (!isOpenApiSpecResourcePathname(np) && !isDocumentationViewerPathname(np)) {
        return np;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Swagger 2.0: toglie basePath dal pathname della richiesta (es. /v2/pet/1 -> /pet/1). */
export function stripSwagger2BasePathFromPathname(
  pathname: string,
  doc: Record<string, unknown>
): string {
  const bp = doc.basePath;
  if (typeof bp !== 'string' || !bp.trim()) return pathname;
  let normP = pathname.replace(/\/$/, '') || '/';
  let normB = bp.trim();
  if (!normB.startsWith('/')) normB = `/${normB}`;
  normB = normB.replace(/\/$/, '') || '/';
  if (normB === '/') return pathname;
  if (normP === normB || normP.startsWith(`${normB}/`)) {
    const rest = normP === normB ? '/' : normP.slice(normB.length) || '/';
    return rest === '' ? '/' : rest;
  }
  return pathname;
}

/** Frammenti Redoc/Swagger UI: `#tag/pet`, `#operation/addPet`. */
export function parseOpenApiViewerHash(endpointUrl: string): { tag?: string; operationId?: string } {
  try {
    const raw = new URL(endpointUrl).hash.replace(/^#/, '');
    if (!raw) return {};
    const decoded = decodeURIComponent(raw.replace(/\+/g, ' '));
    const lower = decoded.toLowerCase();
    if (lower.startsWith('tag/')) {
      return { tag: decoded.slice(4).trim() };
    }
    if (lower.startsWith('operation/')) {
      return { operationId: decoded.slice(10).trim() };
    }
  } catch {
    /* ignore */
  }
  return {};
}

function operationHasTag(op: unknown, tag: string): boolean {
  if (!isRecord(op)) return false;
  const tags = op.tags;
  if (!Array.isArray(tags)) return false;
  const tl = tag.trim().toLowerCase();
  return tags.some((t) => typeof t === 'string' && t.toLowerCase() === tl);
}

/** Verbi HTTP considerati per Read API / auto-metodo. */
export const READ_API_HTTP_VERBS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

/**
 * Sceglie il verbo HTTP per un Path Item OpenAPI: rispetta `methodHint` se presente sul path, altrimenti POST poi GET.
 */
export function pickHttpMethodForPathItem(pathItem: unknown, methodHint?: string): string | null {
  if (!isRecord(pathItem)) return null;
  const available = READ_API_HTTP_VERBS.filter((v) => isRecord(pathItem[v]));
  if (available.length === 0) return null;
  const h = methodHint?.trim().toLowerCase();
  if (h && (available as readonly string[]).includes(h)) return h;
  if (available.includes('post')) return 'post';
  if (available.includes('get')) return 'get';
  return available[0];
}

function pathKeysForVerb(paths: Record<string, unknown>, verb: string): string[] {
  const v = verb.toLowerCase();
  return Object.keys(paths).filter((k) => {
    const item = paths[k];
    return isRecord(item) && isRecord(item[v]);
  });
}

function pathKeysWithAnyVerb(paths: Record<string, unknown>): string[] {
  return Object.keys(paths).filter((k) => {
    const item = paths[k];
    if (!isRecord(item)) return false;
    return READ_API_HTTP_VERBS.some((verb) => isRecord(item[verb]));
  });
}

function findPathAndMethodByOperationId(
  paths: Record<string, unknown>,
  operationId: string
): { pathKey: string; method: string } | null {
  const target = operationId.trim();
  if (!target) return null;
  for (const pk of Object.keys(paths)) {
    const item = paths[pk];
    if (!isRecord(item)) continue;
    for (const verb of READ_API_HTTP_VERBS) {
      const op = item[verb];
      if (isRecord(op) && typeof op.operationId === 'string' && op.operationId === target) {
        return { pathKey: pk, method: verb };
      }
    }
  }
  return null;
}

function sortPathKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Sceglie path + metodo HTTP dallo spec per Read API.
 * Con URL operativo: abbina il pathname; il metodo viene dedotto dal Path Item (hint UI se valido).
 * Con solo Redoc/swagger: `#operation/id` (qualsiasi verbo), `#tag/`, altrimenti path unici / disambiguazione per hint.
 * `operationalPathMatched`: true solo se il pathname dell’URL è stato trovato negli `paths` del documento (contratto noto sul path).
 */
export function pickOpenApiPathForReadApi(
  endpointUrl: string,
  doc: Record<string, unknown>,
  methodHint: string
):
  | { pathKey: string; method: string; operationalPathMatched: boolean }
  | { error: string } {
  const paths = doc.paths;
  if (!isRecord(paths)) {
    return { error: 'Il documento OpenAPI non contiene paths.' };
  }
  const hint = methodHint.trim() || 'get';
  const m = hint.toLowerCase();

  const raw = deriveApiRequestPathnameFromEndpointUrl(endpointUrl);
  if (raw != null) {
    const stripped = stripSwagger2BasePathFromPathname(raw, doc);
    const norm = normalizePathname(stripped);
    const key = matchOpenApiPath(paths, norm);
    if (key) {
      const item = paths[key];
      const method = pickHttpMethodForPathItem(item, hint);
      if (!method) {
        return { error: `Il path ${key} non definisce operazioni HTTP riconosciute.` };
      }
      return { pathKey: key, method, operationalPathMatched: true };
    }
    const suffixKey = matchOpenApiPathBySuffix(paths, norm);
    if (suffixKey) {
      const item = paths[suffixKey];
      const method = pickHttpMethodForPathItem(item, hint);
      if (!method) {
        return { error: `Il path ${suffixKey} non definisce operazioni HTTP riconosciute.` };
      }
      return { pathKey: suffixKey, method, operationalPathMatched: true };
    }
  }

  let pathKeysForMethod = pathKeysForVerb(paths, m);

  if (pathKeysForMethod.length === 0) {
    const anyPaths = pathKeysWithAnyVerb(paths);
    if (anyPaths.length === 1) {
      const pk = anyPaths[0];
      const item = paths[pk];
      const method = pickHttpMethodForPathItem(item, hint);
      if (!method) {
        return { error: `Il path ${pk} non definisce operazioni HTTP riconosciute.` };
      }
      return { pathKey: pk, method, operationalPathMatched: false };
    }
    if (anyPaths.length === 0) {
      return { error: 'Nessun path con operazioni HTTP nello spec.' };
    }
    return {
      error: `Nessuna operazione ${hint.toUpperCase()} nello spec. Inserisci l’URL dell’operazione o scegli un metodo presente nel documento.`,
    };
  }

  if (pathKeysForMethod.length === 1) {
    const pk = pathKeysForMethod[0];
    return { pathKey: pk, method: m, operationalPathMatched: false };
  }

  const hash = parseOpenApiViewerHash(endpointUrl);
  if (hash.operationId) {
    const byOp = findPathAndMethodByOperationId(paths, hash.operationId);
    if (byOp) return { pathKey: byOp.pathKey, method: byOp.method, operationalPathMatched: false };
  }
  if (hash.tag) {
    const tagged = pathKeysForMethod.filter((pk) => {
      const item = paths[pk];
      if (!isRecord(item)) return false;
      return operationHasTag(item[m], hash.tag!);
    });
    if (tagged.length === 1) {
      return { pathKey: tagged[0], method: m, operationalPathMatched: false };
    }
    if (tagged.length > 1) {
      return { pathKey: sortPathKeys(tagged)[0], method: m, operationalPathMatched: false };
    }
  }

  return { pathKey: sortPathKeys(pathKeysForMethod)[0], method: m, operationalPathMatched: false };
}

export function extractOperationFields(
  doc: Record<string, unknown>,
  pathKey: string,
  method: string
): OpenApiOperationFields | null {
  const paths = doc.paths;
  if (!isRecord(paths)) return null;
  const pathItem = paths[pathKey];
  if (!isRecord(pathItem)) return null;
  const op = pathItem[method.toLowerCase()];
  if (!isRecord(op)) return null;

  const operationIdRaw = op.operationId;
  const operationId =
    typeof operationIdRaw === 'string' && operationIdRaw.trim().length > 0
      ? operationIdRaw.trim()
      : undefined;

  const summaryRaw = op.summary;
  const operationSummary =
    typeof summaryRaw === 'string' && summaryRaw.trim().length > 0 ? summaryRaw.trim() : undefined;
  const descOpRaw = op.description;
  const operationDescription =
    typeof descOpRaw === 'string' && descOpRaw.trim().length > 0 ? descOpRaw.trim() : undefined;

  const inputDescriptionsByApiName: Record<string, string> = {};
  const outputDescriptionsByApiName: Record<string, string> = {};
  const inputUiKindByApiName: Record<string, OpenApiInputUiKind> = {};
  const inputEnumByApiName: Record<string, string[]> = {};
  const bindingPhaseByApiName: Record<string, 'design' | 'runtime'> = {};

  let sendBindingRules: OpenApiSendBindingRules | undefined;

  const inputJsonSchemaByApiName: Record<string, Record<string, unknown>> = {};
  const outputJsonSchemaByApiName: Record<string, Record<string, unknown>> = {};
  const inputParamHintsByPath: Record<string, OpenApiParamPathHint> = {};
  const outputParamHintsByPath: Record<string, OpenApiParamPathHint> = {};

  const requestParamNames: string[] = [];
  let requestBodyPropertyNames: string[] = [];
  const params = op.parameters;
  if (Array.isArray(params)) {
    for (const p of params) {
      if (!isRecord(p)) continue;
      const inn = String(p.in || '');
      const name = String(p.name || '').trim();
      if (inn === 'query' || inn === 'path' || inn === 'header') {
        if (name) {
          requestParamNames.push(name);
          setFirstDescription(inputDescriptionsByApiName, name, p.description);
          if (typeof p.description === 'string' && p.description.trim()) {
            inputParamHintsByPath[name] = {
              ...(inputParamHintsByPath[name] ?? {}),
              description: p.description.trim(),
            };
          }
          if (isRecord(p.schema)) {
            setFirstUiKind(inputUiKindByApiName, name, doc, p.schema);
          } else if (p.type !== undefined || p.format !== undefined) {
            const k = openApiSchemaToInputUiKind(doc, { type: p.type, format: p.format });
            if (!inputUiKindByApiName[name]) inputUiKindByApiName[name] = k;
          } else if (!inputUiKindByApiName[name]) {
            inputUiKindByApiName[name] = 'text';
          }
        }
        continue;
      }
      /** Swagger 2.0: body in parameters[] */
      if (inn === 'body' && isRecord(p.schema)) {
        const keys = schemaPropertyKeys(doc, p.schema);
        requestBodyPropertyNames = mergeUnique(requestBodyPropertyNames, keys);
        mergeDescriptionMaps(inputDescriptionsByApiName, schemaPropertyDescriptions(doc, p.schema));
        mergeParamHintMaps(inputParamHintsByPath, schemaPropertyParamHintsByPath(doc, p.schema));
        mergeUiKindMaps(inputUiKindByApiName, schemaPropertyInputKinds(doc, p.schema));
        mergeEnumMaps(inputEnumByApiName, schemaPropertyEnums(doc, p.schema));
        mergeBindingPhaseMaps(bindingPhaseByApiName, schemaPropertyBindingPhases(doc, p.schema));
        mergeJsonSchemaFragmentMaps(
          inputJsonSchemaByApiName,
          schemaPropertyJsonSchemaFragmentsForTool(doc, p.schema)
        );
        const sb = extractOmniaSendBindingRules(doc, p.schema);
        if (sb) sendBindingRules = sb;
      }
      /** formData → trattati come nomi campo inviati */
      if (inn === 'formData' && name) {
        requestParamNames.push(name);
        setFirstDescription(inputDescriptionsByApiName, name, p.description);
        if (isRecord(p.schema)) {
          setFirstUiKind(inputUiKindByApiName, name, doc, p.schema);
          const ev = enumValuesFromPropertySchema(doc, p.schema);
          if (ev?.length) setFirstEnum(inputEnumByApiName, name, ev);
        } else if (p.type !== undefined || p.format !== undefined) {
          const k = openApiSchemaToInputUiKind(doc, { type: p.type, format: p.format });
          if (!inputUiKindByApiName[name]) inputUiKindByApiName[name] = k;
        }
      }
    }
  }

  const rb = op.requestBody;
  if (isRecord(rb)) {
    const content = rb.content;
    if (isRecord(content)) {
      const json =
        (content['application/json'] as unknown) ||
        (content['application/*+json'] as unknown) ||
        content[Object.keys(content).find((k) => k.includes('json')) || ''];
      if (isRecord(json) && isRecord(json.schema)) {
        const keys = schemaPropertyKeys(doc, json.schema);
        requestBodyPropertyNames = mergeUnique(requestBodyPropertyNames, keys);
        mergeDescriptionMaps(inputDescriptionsByApiName, schemaPropertyDescriptions(doc, json.schema));
        mergeParamHintMaps(inputParamHintsByPath, schemaPropertyParamHintsByPath(doc, json.schema));
        mergeUiKindMaps(inputUiKindByApiName, schemaPropertyInputKinds(doc, json.schema));
        mergeEnumMaps(inputEnumByApiName, schemaPropertyEnums(doc, json.schema));
        mergeBindingPhaseMaps(bindingPhaseByApiName, schemaPropertyBindingPhases(doc, json.schema));
        mergeJsonSchemaFragmentMaps(
          inputJsonSchemaByApiName,
          schemaPropertyJsonSchemaFragmentsForTool(doc, json.schema)
        );
        const sb = extractOmniaSendBindingRules(doc, json.schema);
        if (sb) sendBindingRules = sb;
      }
    }
  }

  let responsePropertyNames: string[] = [];
  const responses = op.responses;
  if (isRecord(responses)) {
    const code =
      responses['200'] || responses['201'] || responses['202'] || responses['204'] || responses['default'];
    if (isRecord(code)) {
      const content = code.content;
      if (isRecord(content)) {
        const json =
          (content['application/json'] as unknown) ||
          content[Object.keys(content).find((k) => k.includes('json')) || ''];
        if (isRecord(json) && isRecord(json.schema)) {
          responsePropertyNames = schemaPropertyKeys(doc, json.schema);
          mergeDescriptionMaps(outputDescriptionsByApiName, schemaPropertyDescriptions(doc, json.schema));
          mergeParamHintMaps(outputParamHintsByPath, schemaPropertyParamHintsByPath(doc, json.schema));
          mergeJsonSchemaFragmentMaps(
            outputJsonSchemaByApiName,
            schemaPropertyJsonSchemaFragmentsForTool(doc, json.schema)
          );
        }
      }
      /** Swagger 2.0: schema direttamente sulla risposta */
      if (responsePropertyNames.length === 0 && isRecord(code.schema)) {
        responsePropertyNames = schemaPropertyKeys(doc, code.schema);
        mergeDescriptionMaps(outputDescriptionsByApiName, schemaPropertyDescriptions(doc, code.schema));
        mergeParamHintMaps(outputParamHintsByPath, schemaPropertyParamHintsByPath(doc, code.schema));
        mergeJsonSchemaFragmentMaps(
          outputJsonSchemaByApiName,
          schemaPropertyJsonSchemaFragmentsForTool(doc, code.schema)
        );
      }
    }
  }

  return {
    ...(operationId ? { operationId } : {}),
    ...(operationSummary ? { operationSummary } : {}),
    ...(operationDescription ? { operationDescription } : {}),
    requestParamNames,
    requestBodyPropertyNames,
    responsePropertyNames,
    inputDescriptionsByApiName,
    outputDescriptionsByApiName,
    inputUiKindByApiName,
    inputEnumByApiName,
    ...(sendBindingRules ? { sendBindingRules } : {}),
    ...(Object.keys(bindingPhaseByApiName).length > 0 ? { bindingPhaseByApiName } : {}),
    ...(Object.keys(inputJsonSchemaByApiName).length > 0 ? { inputJsonSchemaByApiName } : {}),
    ...(Object.keys(outputJsonSchemaByApiName).length > 0 ? { outputJsonSchemaByApiName } : {}),
    ...(Object.keys(inputParamHintsByPath).length > 0 ? { inputParamHintsByPath } : {}),
    ...(Object.keys(outputParamHintsByPath).length > 0 ? { outputParamHintsByPath } : {}),
  };
}

const OPERATION_DOC_BLURB_MAX = 4000;

/**
 * Testo unico per descrizione tool / UI: combina summary e description OpenAPI dell’operazione.
 */
export function buildOperationDocBlurbFromOpenApiFields(fields: OpenApiOperationFields): string {
  const s = fields.operationSummary?.trim() || '';
  const d = fields.operationDescription?.trim() || '';
  if (!s && !d) return '';
  if (s && d && s !== d) {
    return `${s}\n\n${d}`.slice(0, OPERATION_DOC_BLURB_MAX);
  }
  return (s || d).slice(0, OPERATION_DOC_BLURB_MAX);
}

const SPEC_CANDIDATE_PATHS = [
  '/swagger.json',
  '/openapi.json',
  '/v3/api-docs',
  '/api/v3/api-docs',
  '/api-docs',
  '/api/swagger.json',
  '/swagger/v1/swagger.json',
  '/swagger-ui/swagger.json',
  '/doc/swagger.json',
];

function pathnamePrefixes(pathname: string): string[] {
  if (!pathname || pathname === '/') return [];
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [];
  const out: string[] = [];
  for (let i = parts.length; i > 0; i--) {
    out.push(`/${parts.slice(0, i).join('/')}`);
  }
  return out;
}

function joinOriginSpec(origin: string, pathPrefix: string, specSuffix: string): string {
  const p = pathPrefix.replace(/\/$/, '');
  return `${origin}${p}${specSuffix}`;
}

const NESTED_SPEC_QUERY_KEYS = new Set(['url', 'spec', 'openapi', 'swaggerurl', 'swagger_url']);

/**
 * Redoc/Swagger UI passano spesso lo spec in query (?url=https://…/swagger.json).
 */
export function extractNestedSpecUrlsFromEndpoint(endpointUrl: string): string[] {
  try {
    const u = new URL(endpointUrl);
    const out: string[] = [];
    u.searchParams.forEach((value, key) => {
      if (!NESTED_SPEC_QUERY_KEYS.has(key.toLowerCase())) return;
      let s = value.trim();
      try {
        s = decodeURIComponent(s);
      } catch {
        /* usa raw */
      }
      s = s.replace(/^["']|["']$/g, '').trim();
      if (s.startsWith('http://') || s.startsWith('https://')) {
        out.push(s);
      }
    });
    return [...new Set(out)];
  } catch {
    return [];
  }
}

/** Headers per fetch OpenAPI (ngrok free: evita interstiziale HTML). */
export function openApiFetchHeadersForUrl(url: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json, */*',
  };
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('ngrok')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
  } catch {
    /* ignore */
  }
  return headers;
}

/** Spec sullo stesso path dell'endpoint operativo (es. …/bookfromagenda/openapi.json). */
export function operationalPathOpenApiCandidateUrls(origin: string, pathname: string): string[] {
  const p = pathname.replace(/\/+$/, '');
  if (!p || p === '/') return [];
  return [`${origin}${p}/openapi.json`, `${origin}${p}/swagger.json`];
}

function collectCandidateUrlsForSeed(seed: string): string[] {
  let base: URL;
  try {
    base = new URL(seed);
  } catch {
    return [seed];
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    return [seed];
  }
  const origin = `${base.protocol}//${base.host}`;
  const urls: string[] = [seed];
  for (const u of operationalPathOpenApiCandidateUrls(origin, base.pathname)) {
    urls.push(u);
  }
  for (const prefix of pathnamePrefixes(base.pathname)) {
    for (const sp of SPEC_CANDIDATE_PATHS) {
      urls.push(joinOriginSpec(origin, prefix, sp));
    }
  }
  for (const sp of SPEC_CANDIDATE_PATHS) {
    urls.push(`${origin}${sp}`);
  }
  return urls;
}

/** Ordine di prova allineato al proxy Python (seed + ?url= + candidati per origine). */
export function buildOpenApiCandidateUrlList(endpointUrl: string): string[] {
  const trimmed = endpointUrl.trim();
  const seeds = [trimmed, ...extractNestedSpecUrlsFromEndpoint(trimmed)];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const seed of seeds) {
    for (const u of collectCandidateUrlsForSeed(seed)) {
      if (seen.has(u)) continue;
      seen.add(u);
      ordered.push(u);
    }
  }
  return ordered;
}

const OPENAPI_PROXY_PATH = '/api/openapi-proxy';

export type FetchOpenApiDocumentOptions = {
  /** PortalConnection id — proxy aggiunge Authorization Bearer. */
  connectionId?: string;
  /** Evita cache locale e rigenera SEND/RECEIVE da zero (Recupera specifiche). */
  forceRefresh?: boolean;
};

/** Query param anti-cache su URL OpenAPI diretti (non altera path operativo sul proxy). */
function openApiDirectFetchUrl(url: string, forceRefresh?: boolean): string {
  if (!forceRefresh) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('_omniaRefresh', String(Date.now()));
    return u.toString();
  } catch {
    return url;
  }
}

function openApiFetchInit(url: string, forceRefresh?: boolean): RequestInit {
  return {
    credentials: 'omit',
    headers: openApiFetchHeadersForUrl(url),
    ...(forceRefresh ? { cache: 'no-store' as RequestCache } : {}),
  };
}

/**
 * FastAPI scarica lo spec lato server (niente CORS). Se il backend non risponde, si torna al fetch diretto.
 */
async function tryFetchOpenApiViaBackendProxy(
  endpointUrl: string,
  options?: FetchOpenApiDocumentOptions
): Promise<{ doc: Record<string, unknown>; sourceUrl: string } | null> {
  const qs = new URLSearchParams({ url: endpointUrl });
  const cid = (options?.connectionId || '').trim();
  if (cid) qs.set('connection_id', cid);
  if (options?.forceRefresh) qs.set('_refresh', String(Date.now()));
  let res: Response;
  try {
    res = await fetch(`${OPENAPI_PROXY_PATH}?${qs.toString()}`, openApiFetchInit(endpointUrl, options?.forceRefresh));
  } catch {
    return null;
  }

  if (res.ok) {
    const data = (await res.json()) as unknown;
    if (!isRecord(data) || (!data.openapi && !data.swagger)) {
      throw new Error('Risposta proxy non valida');
    }
    return { doc: data, sourceUrl: endpointUrl };
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return null;
  }
  if (res.status === 404) {
    return null;
  }

  let detail: unknown = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { detail?: unknown };
    detail = j.detail ?? detail;
  } catch {
    try {
      const t = await res.text();
      if (t) detail = t.slice(0, 500);
    } catch {
      /* ignore */
    }
  }

  const { parsePortalAuthHttpError, inferPortalAuthFromFailedOpenApiFetch } = await import(
    './portalAuthErrors'
  );
  const portalErr =
    parsePortalAuthHttpError(res.status, detail) ??
    inferPortalAuthFromFailedOpenApiFetch(endpointUrl, detail, res.status);
  if (portalErr) throw portalErr;

  if (res.status === 422) {
    const { parseOpenApiNotFoundDetail, OpenApiNotFoundError, defaultOpenApiNotFoundMessage } =
      await import('./openApiDiscoveryErrors');
    const notFound =
      parseOpenApiNotFoundDetail(detail, Boolean(cid)) ??
      (cid
        ? new OpenApiNotFoundError(defaultOpenApiNotFoundMessage(true), true)
        : null);
    if (notFound) throw notFound;
  }

  const detailStr =
    typeof detail === 'string'
      ? detail
      : detail !== undefined
        ? JSON.stringify(detail)
        : `HTTP ${res.status}`;
  throw new Error(detailStr);
}

/**
 * Fetch dal browser: stesso host o server con CORS abilitato.
 */
async function fetchOpenApiDocumentDirect(
  endpointUrl: string,
  options?: FetchOpenApiDocumentOptions
): Promise<{ doc: Record<string, unknown>; sourceUrl: string }> {
  try {
    new URL(endpointUrl);
  } catch {
    throw new Error('URL non valido');
  }

  const tryParse = async (url: string): Promise<Record<string, unknown>> => {
    const fetchUrl = openApiDirectFetchUrl(url, options?.forceRefresh);
    const res = await fetch(fetchUrl, openApiFetchInit(fetchUrl, options?.forceRefresh));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as unknown;
    if (!isRecord(data)) throw new Error('Risposta non JSON');
    if (data.openapi || data.swagger) return data;
    throw new Error('Non è un documento OpenAPI/Swagger');
  };

  const orderedUrls = buildOpenApiCandidateUrlList(endpointUrl);
  for (const u of orderedUrls) {
    try {
      const data = await tryParse(u);
      return { doc: data, sourceUrl: u };
    } catch {
      /* next */
    }
  }

  throw new Error(
    'Impossibile caricare OpenAPI. Incolla l’URL del JSON (es. …/v3/api-docs) o l’URL base dell’API; le pagine HTML Redoc/Swagger UI non sono documenti OpenAPI.'
  );
}

/**
 * Carica il documento OpenAPI: prima proxy backend (evita CORS), poi fetch diretto come fallback.
 */
export async function fetchOpenApiDocument(
  endpointUrl: string,
  options?: FetchOpenApiDocumentOptions
): Promise<{ doc: Record<string, unknown>; sourceUrl: string }> {
  const trimmed = endpointUrl.trim();
  if (!trimmed) {
    throw new Error('URL non valido');
  }

  const viaProxy = await tryFetchOpenApiViaBackendProxy(trimmed, options);
  if (viaProxy) {
    return viaProxy;
  }

  return fetchOpenApiDocumentDirect(trimmed, options);
}

/**
 * Read API: prima discovery dall’endpoint operativo (candidati standard sulla stessa origine).
 * Solo se fallisce e `manualSpecUrl` è valorizzato, secondo tentativo da Spec URL manuale.
 */
export async function fetchOpenApiDocumentOperationalThenManualFallback(
  operationalUrl: string,
  manualSpecUrl?: string,
  options?: FetchOpenApiDocumentOptions
): Promise<{ doc: Record<string, unknown>; sourceUrl: string }> {
  const op = operationalUrl.trim();
  const manual = (manualSpecUrl || '').trim();
  if (op) {
    try {
      return await fetchOpenApiDocument(op, options);
    } catch (e) {
      if (manual) {
        return await fetchOpenApiDocument(manual, options);
      }
      throw e;
    }
  }
  if (manual) {
    return await fetchOpenApiDocument(manual, options);
  }
  throw new Error('Inserire endpoint operativo o Spec URL (OpenAPI).');
}

export function slugInternalName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'field';
}
