/**
 * Ripulisce tool webhook ConvAI prima di POST/PATCH agente ElevenLabs.
 * L’API EU usa schemi strict (Pydantic): campi extra → HTTP 400 «Extra inputs are not permitted».
 */

const LITERAL_KEYS = new Set([
  'type',
  'description',
  'enum',
  'constant_value',
  'is_system_provided',
  'dynamic_variable',
  'is_omitted',
]);

const OBJECT_KEYS = new Set(['type', 'description', 'properties', 'required', 'required_constraints']);

const ARRAY_KEYS = new Set(['type', 'description', 'items', 'dynamic_variable', 'constant_value']);

const QUERY_ROOT_KEYS = new Set(['properties', 'required']);

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function pickKeys(row: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

function sanitizeLiteralProperty(row: Record<string, unknown>): Record<string, unknown> {
  const out = pickKeys(row, LITERAL_KEYS);
  if (!out.type) out.type = 'string';
  if (typeof out.description !== 'string') out.description = '';
  if (Object.prototype.hasOwnProperty.call(row, 'const') && !Object.prototype.hasOwnProperty.call(out, 'constant_value')) {
    out.constant_value = row.const;
  }
  if (Array.isArray(out.enum)) {
    out.enum = out.enum.map((v) => String(v));
  }
  return out;
}

function sanitizeSchemaNode(raw: unknown, depth = 0): Record<string, unknown> {
  if (!isRecord(raw)) {
    return { type: 'string', description: '' };
  }
  if (depth > 14) {
    return { type: 'string', description: 'Parametro (profondità max)' };
  }

  const type = String(raw.type ?? '').trim().toLowerCase();
  if (type === 'object' && isRecord(raw.properties)) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw.properties)) {
      props[k] = sanitizeSchemaNode(v, depth + 1);
    }
    const out: Record<string, unknown> = {
      type: 'object',
      properties: props,
    };
    if (typeof raw.description === 'string' && raw.description.trim()) {
      out.description = raw.description.trim();
    }
    if (Array.isArray(raw.required) && raw.required.every((x) => typeof x === 'string')) {
      out.required = [...raw.required];
    }
    if (raw.required_constraints !== undefined && raw.required_constraints !== null) {
      out.required_constraints = raw.required_constraints;
    }
    return pickKeys(out, OBJECT_KEYS);
  }

  if (type === 'array' && raw.items !== undefined) {
    const out: Record<string, unknown> = {
      type: 'array',
      items: sanitizeSchemaNode(raw.items, depth + 1),
    };
    if (typeof raw.description === 'string' && raw.description.trim()) {
      out.description = raw.description.trim();
    }
    if (raw.dynamic_variable !== undefined) out.dynamic_variable = raw.dynamic_variable;
    if (raw.constant_value !== undefined) out.constant_value = raw.constant_value;
    return pickKeys(out, ARRAY_KEYS);
  }

  return sanitizeLiteralProperty(raw);
}

function sanitizeQueryParamsSchema(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, unknown> = {};
  if (isRecord(raw.properties)) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw.properties)) {
      props[k] = sanitizeLiteralProperty(isRecord(v) ? v : { type: 'string', description: '' });
    }
    out.properties = props;
  }
  if (Array.isArray(raw.required) && raw.required.every((x) => typeof x === 'string')) {
    out.required = [...raw.required];
  }
  return pickKeys(out, QUERY_ROOT_KEYS);
}

function sanitizeRequestBodySchema(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined;
  return sanitizeSchemaNode({ ...raw, type: 'object' });
}

function sanitizeApiSchema(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, unknown> = {};
  if (typeof raw.url === 'string') out.url = raw.url;
  const method =
    typeof raw.method === 'string'
      ? raw.method.trim().toUpperCase()
      : typeof raw.http_method === 'string'
        ? raw.http_method.trim().toUpperCase()
        : '';
  if (method) out.method = method;
  if (isRecord(raw.request_headers) && Object.keys(raw.request_headers).length > 0) {
    out.request_headers = raw.request_headers;
  }
  if (raw.path_params_schema !== undefined && isRecord(raw.path_params_schema)) {
    out.path_params_schema = raw.path_params_schema;
  }
  const qps = sanitizeQueryParamsSchema(raw.query_params_schema);
  if (qps) out.query_params_schema = qps;
  const body = sanitizeRequestBodySchema(raw.request_body_schema);
  if (body) out.request_body_schema = body;
  if (raw.content_type !== undefined) out.content_type = raw.content_type;
  return out;
}

/** Tool inline `webhook` pronto per PATCH/POST ConvAI (niente chiavi extra). */
export function sanitizeConvaiWebhookToolForApi(tool: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: String(tool.type ?? 'webhook').trim() || 'webhook',
    name: String(tool.name ?? '').trim(),
    description: String(tool.description ?? '').trim(),
  };
  const api = sanitizeApiSchema(tool.api_schema);
  if (api) out.api_schema = api;
  const timeout = tool.response_timeout_secs;
  if (typeof timeout === 'number' && timeout >= 5 && timeout <= 120) {
    out.response_timeout_secs = Math.floor(timeout);
  }
  return out;
}

/** Sanitizza `prompt.tools` in un frammento `conversation_config`. */
export function sanitizeConvaiConversationConfigForApi(
  config: Record<string, unknown>
): Record<string, unknown> {
  const cc = { ...config };
  const agent = cc.agent;
  if (!isRecord(agent)) return cc;
  const prompt = agent.prompt;
  if (!isRecord(prompt)) return cc;
  const toolsRaw = prompt.tools;
  if (!Array.isArray(toolsRaw)) return cc;

  const tools = toolsRaw.map((t) => {
    if (!isRecord(t)) return t;
    if (String(t.type ?? '').trim().toLowerCase() === 'webhook') {
      return sanitizeConvaiWebhookToolForApi(t);
    }
    return t;
  });

  return {
    ...cc,
    agent: {
      ...agent,
      prompt: {
        ...prompt,
        tools,
      },
    },
  };
}
