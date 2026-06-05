/**
 * Adattatore JSON Schema OpenAPI (materializzato Omnia) → dialecto tool ConvAI ElevenLabs
 * (`request_body_schema` / `query_params_schema`).
 * Espande oggetti/array annidati; rimuove chiavi non accettate dall’API EU.
 */

const MAX_ADAPT_DEPTH = 12;
const MAX_PROPERTIES_PER_OBJECT = 80;

const ELEVENLABS_JSON_TYPES = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
]);

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function enumMemberToElevenLabsString(v: unknown): string {
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string') return v;
  return String(v);
}

/**
 * ConvAI EU: enum solo con `type: "string"`; boolean const → string `"true"` / `"false"`.
 */
export function adaptEnumsAndConstsForElevenLabsConvai(row: Record<string, unknown>): void {
  const en = row.enum;
  if (Array.isArray(en) && en.length > 0) {
    row.type = 'string';
    row.enum = en.map((v) => enumMemberToElevenLabsString(v));
    return;
  }
  if (Object.prototype.hasOwnProperty.call(row, 'const')) {
    const c = row.const;
    if (c === true || c === false) {
      row.type = 'string';
      row.const = c === true ? 'true' : 'false';
    }
  }
}

function effectiveOpenApiType(schema: Record<string, unknown>): string {
  const t = schema.type;
  if (typeof t === 'string' && ELEVENLABS_JSON_TYPES.has(t)) return t;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return 'string';
  if (isRecord(schema.properties) && Object.keys(schema.properties).length > 0) return 'object';
  if (schema.items !== undefined) return 'array';
  return 'string';
}

function stripOpenApiExtensions(node: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(node)) {
    if (key === 'additionalProperties' || key === '$ref' || key === 'x-omnia-unresolvedRef') {
      continue;
    }
    if (key.startsWith('x-omnia') || key.startsWith('x-runtime')) continue;
    out[key] = val;
  }
  return out;
}

/** Unisce `allOf` / singolo `$ref` non risolto in un unico oggetto property-like. */
function normalizeSourceNode(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  let node = stripOpenApiExtensions(raw);

  if (Array.isArray(node.allOf) && node.allOf.length > 0) {
    const propsAcc: Record<string, unknown> = {};
    let desc = typeof node.description === 'string' ? node.description : '';
    let type = typeof node.type === 'string' ? node.type : '';
    for (const sub of node.allOf) {
      if (!isRecord(sub)) continue;
      const m = normalizeSourceNode(sub);
      if (typeof m.description === 'string' && m.description.trim() && !desc) {
        desc = m.description.trim();
      }
      if (typeof m.type === 'string' && m.type && !type) type = m.type;
      if (isRecord(m.properties)) {
        for (const [pk, pv] of Object.entries(m.properties)) {
          propsAcc[pk] = pv;
        }
      }
    }
    const merged: Record<string, unknown> = { ...node };
    delete merged.allOf;
    if (Object.keys(propsAcc).length > 0) merged.properties = propsAcc;
    if (desc) merged.description = desc;
    if (type) merged.type = type;
    node = merged;
  }

  if (Array.isArray(node.oneOf) && node.oneOf.length > 0 && isRecord(node.oneOf[0])) {
    node = { ...node, ...normalizeSourceNode(node.oneOf[0]) };
    delete node.oneOf;
  }
  if (Array.isArray(node.anyOf) && node.anyOf.length > 0 && isRecord(node.anyOf[0])) {
    node = { ...node, ...normalizeSourceNode(node.anyOf[0]) };
    delete node.anyOf;
  }

  return stripOpenApiExtensions(node);
}

function adaptSchemaProperty(
  raw: unknown,
  pathPrefix: string,
  depth: number
): Record<string, unknown> {
  if (depth > MAX_ADAPT_DEPTH) {
    return {
      type: 'string',
      description: `Parametro ${pathPrefix} (limite profondità schema)`,
    };
  }

  const src = normalizeSourceNode(raw);
  const nameLeaf = pathPrefix.split('.').pop() || pathPrefix || 'param';
  const desc =
    typeof src.description === 'string' && src.description.trim()
      ? src.description.trim()
      : `Parametro ${nameLeaf}`;

  const type = effectiveOpenApiType(src);
  const row: Record<string, unknown> = { description: desc, type };

  if (typeof src.format === 'string' && src.format.trim()) {
    row.format = src.format.trim();
  }
  for (const bound of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'] as const) {
    const v = src[bound];
    if (typeof v === 'number' && !Number.isNaN(v)) row[bound] = v;
  }

  if (Array.isArray(src.enum) && src.enum.length > 0) {
    row.enum = [...src.enum];
  }
  if (Object.prototype.hasOwnProperty.call(src, 'const')) {
    row.const = src.const;
  }
  adaptEnumsAndConstsForElevenLabsConvai(row);

  if (type === 'object' && isRecord(src.properties)) {
    const nested: Record<string, unknown> = {};
    let count = 0;
    for (const [key, child] of Object.entries(src.properties)) {
      if (count >= MAX_PROPERTIES_PER_OBJECT) break;
      const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      nested[key] = adaptSchemaProperty(child, childPath, depth + 1);
      count += 1;
    }
    if (Object.keys(nested).length > 0) {
      row.properties = nested;
    }
    if (Array.isArray(src.required) && src.required.every((x) => typeof x === 'string')) {
      row.required = [...src.required];
    }
  }

  if (type === 'array' && src.items !== undefined) {
    const itemsPath = pathPrefix ? `${pathPrefix}[]` : '[]';
    row.items = adaptSchemaProperty(src.items, itemsPath, depth + 1);
  }

  return row;
}

/** Converte `properties` OpenAPI in `properties` ElevenLabs (ricorsivo). */
export function adaptOpenApiPropertiesToElevenLabs(
  props: Record<string, unknown> | undefined,
  depth = 0
): Record<string, unknown> {
  if (!props || !isRecord(props)) return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [name, raw] of Object.entries(props)) {
    if (count >= MAX_PROPERTIES_PER_OBJECT) break;
    out[name] = adaptSchemaProperty(raw, name, depth);
    count += 1;
  }
  return out;
}

export type ElevenLabsToolSchemaOptions = {
  /** Descrizione radice richiesta dalla UI ConvAI (`request_body_schema` / query). */
  description?: string;
};

function resolveRootSchemaDescription(
  inputSchema: Record<string, unknown>,
  options?: ElevenLabsToolSchemaOptions
): string {
  const fromOpt = String(options?.description ?? '').trim();
  if (fromOpt) return fromOpt;
  const fromSchema =
    typeof inputSchema.description === 'string' ? inputSchema.description.trim() : '';
  if (fromSchema) return fromSchema;
  return 'Parametri del body JSON inviati al webhook.';
}

/**
 * `request_body_schema` per tool webhook POST/PUT: radice `type: object` + properties annidate.
 */
export function toElevenLabsRequestBodySchema(
  inputSchema: Record<string, unknown>,
  options?: ElevenLabsToolSchemaOptions
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: 'object',
    description: resolveRootSchemaDescription(inputSchema, options),
    properties: adaptOpenApiPropertiesToElevenLabs(
      inputSchema.properties as Record<string, unknown> | undefined
    ),
  };
  const req = inputSchema.required;
  if (Array.isArray(req) && req.every((x) => typeof x === 'string')) {
    out.required = [...req];
  }
  return out;
}

/**
 * Proprietà query string ConvAI EU: solo boolean | string | integer | number (no object/array).
 */
function adaptSchemaPropertyForQueryParam(
  raw: unknown,
  pathPrefix: string
): Record<string, unknown> {
  const src = normalizeSourceNode(raw);
  const nameLeaf = pathPrefix.split('.').pop() || pathPrefix || 'param';
  const desc =
    typeof src.description === 'string' && src.description.trim()
      ? src.description.trim()
      : `Parametro ${nameLeaf}`;

  const type = effectiveOpenApiType(src);
  if (type === 'object' || type === 'array') {
    return {
      type: 'string',
      description: `${desc} (passa come stringa JSON)`,
    };
  }

  const row: Record<string, unknown> = { description: desc, type };

  if (typeof src.format === 'string' && src.format.trim()) {
    row.format = src.format.trim();
  }
  for (const bound of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'] as const) {
    const v = src[bound];
    if (typeof v === 'number' && !Number.isNaN(v)) row[bound] = v;
  }

  if (Array.isArray(src.enum) && src.enum.length > 0) {
    row.enum = [...src.enum];
  }
  if (Object.prototype.hasOwnProperty.call(src, 'const')) {
    row.const = src.const;
  }
  adaptEnumsAndConstsForElevenLabsConvai(row);

  return row;
}

/** Converte `properties` OpenAPI in query params ElevenLabs (solo tipi primitivi). */
export function adaptOpenApiPropertiesToElevenLabsQueryParams(
  props: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!props || !isRecord(props)) return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [name, raw] of Object.entries(props)) {
    if (count >= MAX_PROPERTIES_PER_OBJECT) break;
    out[name] = adaptSchemaPropertyForQueryParam(raw, name);
    count += 1;
  }
  return out;
}

/**
 * `query_params_schema`: solo `properties` + `required` (no `type`/`description` in radice — extra_forbidden EU).
 */
export function toElevenLabsQueryParamsSchema(
  inputSchema: Record<string, unknown>,
  _options?: ElevenLabsToolSchemaOptions
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    properties: adaptOpenApiPropertiesToElevenLabsQueryParams(
      inputSchema.properties as Record<string, unknown> | undefined
    ),
  };
  const req = inputSchema.required;
  if (Array.isArray(req) && req.every((x) => typeof x === 'string')) {
    out.required = [...req];
  }
  return out;
}
