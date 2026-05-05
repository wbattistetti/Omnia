/**
 * Fetches OpenAPI/Swagger JSON and extracts request/response field names for a Backend Call operation.
 * Shallow $ref resolution via #/components/schemas/... only.
 */

/** Kind per `input` HTML5 nelle celle mock (chiave = nome campo API). */
export type OpenApiInputUiKind = 'text' | 'number' | 'date' | 'time' | 'datetime-local';

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
  /** Tipo UI input (date/time/number) dedotto da schema OpenAPI. */
  inputUiKindByApiName: Record<string, OpenApiInputUiKind>;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function resolveRef(root: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/');
  let cur: unknown = root;
  for (const p of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
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

function mergeDescriptionMaps(target: Record<string, string>, source: Record<string, string>): void {
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key || target[key]) continue;
    const t = v.trim();
    if (t) target[key] = t;
  }
}

function mergeUiKindMaps(target: Record<string, OpenApiInputUiKind>, source: Record<string, OpenApiInputUiKind>): void {
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key || target[key]) continue;
    target[key] = v;
  }
}

/** Risolve $ref e mappa `type`/`format` JSON Schema → controllo HTML5. */
export function openApiSchemaToInputUiKind(root: Record<string, unknown>, schema: unknown): OpenApiInputUiKind {
  let cur: unknown = schema;
  for (let i = 0; i < 12; i++) {
    if (!isRecord(cur)) return 'text';
    if (typeof cur.$ref === 'string') {
      cur = resolveRef(root, cur.$ref);
      continue;
    }
    const t = String(cur.type || '').toLowerCase();
    const f = typeof cur.format === 'string' ? cur.format.toLowerCase() : '';
    if (t === 'integer' || t === 'number') return 'number';
    if (t === 'string') {
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

/** Path della risorsa swagger/openapi (non è un path di operazione API). */
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
 */
export function pickOpenApiPathForReadApi(
  endpointUrl: string,
  doc: Record<string, unknown>,
  methodHint: string
): { pathKey: string; method: string } | { error: string } {
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
      return { pathKey: key, method };
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
      return { pathKey: pk, method };
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
    return { pathKey: pk, method: m };
  }

  const hash = parseOpenApiViewerHash(endpointUrl);
  if (hash.operationId) {
    const byOp = findPathAndMethodByOperationId(paths, hash.operationId);
    if (byOp) return { pathKey: byOp.pathKey, method: byOp.method };
  }
  if (hash.tag) {
    const tagged = pathKeysForMethod.filter((pk) => {
      const item = paths[pk];
      if (!isRecord(item)) return false;
      return operationHasTag(item[m], hash.tag!);
    });
    if (tagged.length === 1) {
      return { pathKey: tagged[0], method: m };
    }
    if (tagged.length > 1) {
      return { pathKey: sortPathKeys(tagged)[0], method: m };
    }
  }

  return { pathKey: sortPathKeys(pathKeysForMethod)[0], method: m };
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
        mergeUiKindMaps(inputUiKindByApiName, schemaPropertyInputKinds(doc, p.schema));
      }
      /** formData → trattati come nomi campo inviati */
      if (inn === 'formData' && name) {
        requestParamNames.push(name);
        setFirstDescription(inputDescriptionsByApiName, name, p.description);
        if (isRecord(p.schema)) {
          setFirstUiKind(inputUiKindByApiName, name, doc, p.schema);
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
        mergeUiKindMaps(inputUiKindByApiName, schemaPropertyInputKinds(doc, json.schema));
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
        }
      }
      /** Swagger 2.0: schema direttamente sulla risposta */
      if (responsePropertyNames.length === 0 && isRecord(code.schema)) {
        responsePropertyNames = schemaPropertyKeys(doc, code.schema);
        mergeDescriptionMaps(outputDescriptionsByApiName, schemaPropertyDescriptions(doc, code.schema));
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
  for (const sp of SPEC_CANDIDATE_PATHS) {
    urls.push(`${origin}${sp}`);
  }
  for (const prefix of pathnamePrefixes(base.pathname)) {
    for (const sp of SPEC_CANDIDATE_PATHS) {
      urls.push(joinOriginSpec(origin, prefix, sp));
    }
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

/**
 * FastAPI scarica lo spec lato server (niente CORS). Se il backend non risponde, si torna al fetch diretto.
 */
async function tryFetchOpenApiViaBackendProxy(
  endpointUrl: string
): Promise<{ doc: Record<string, unknown>; sourceUrl: string } | null> {
  const qs = new URLSearchParams({ url: endpointUrl });
  let res: Response;
  try {
    res = await fetch(`${OPENAPI_PROXY_PATH}?${qs.toString()}`, { credentials: 'omit' });
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

  let detail = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { detail?: unknown };
    if (typeof j.detail === 'string') {
      detail = j.detail;
    } else if (j.detail !== undefined) {
      detail = JSON.stringify(j.detail);
    }
  } catch {
    try {
      const t = await res.text();
      if (t) detail = t.slice(0, 500);
    } catch {
      /* ignore */
    }
  }
  throw new Error(detail);
}

/**
 * Fetch dal browser: stesso host o server con CORS abilitato.
 */
async function fetchOpenApiDocumentDirect(
  endpointUrl: string
): Promise<{ doc: Record<string, unknown>; sourceUrl: string }> {
  try {
    new URL(endpointUrl);
  } catch {
    throw new Error('URL non valido');
  }

  const tryParse = async (url: string): Promise<Record<string, unknown>> => {
    const res = await fetch(url, { credentials: 'omit' });
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
export async function fetchOpenApiDocument(endpointUrl: string): Promise<{ doc: Record<string, unknown>; sourceUrl: string }> {
  const trimmed = endpointUrl.trim();
  if (!trimmed) {
    throw new Error('URL non valido');
  }

  const viaProxy = await tryFetchOpenApiViaBackendProxy(trimmed);
  if (viaProxy) {
    return viaProxy;
  }

  return fetchOpenApiDocumentDirect(trimmed);
}

/**
 * Read API: prima discovery dall’endpoint operativo (candidati standard sulla stessa origine).
 * Solo se fallisce e `manualSpecUrl` è valorizzato, secondo tentativo da Spec URL manuale.
 */
export async function fetchOpenApiDocumentOperationalThenManualFallback(
  operationalUrl: string,
  manualSpecUrl?: string
): Promise<{ doc: Record<string, unknown>; sourceUrl: string }> {
  const op = operationalUrl.trim();
  const manual = (manualSpecUrl || '').trim();
  if (op) {
    try {
      return await fetchOpenApiDocument(op);
    } catch (e) {
      if (manual) {
        return await fetchOpenApiDocument(manual);
      }
      throw e;
    }
  }
  if (manual) {
    return await fetchOpenApiDocument(manual);
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
