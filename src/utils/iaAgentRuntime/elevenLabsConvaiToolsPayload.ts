/**
 * ElevenLabs ConvAI accetta in `conversation_config.agent.prompt.tools` solo tipi
 * `webhook`, `client`, `api_integration_webhook`, ecc. — non il formato OpenAI `type: function`.
 * I Backend Call Omnia diventano tool `webhook` con `api_schema`; i tool manuali in `cfg.tools` → `client`.
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import {
  deriveBackendToolDefinition,
  sanitizeConvaiToolName,
} from '@domain/iaAgentTools/backendToolDerivation';
import { readBackendCallEndpoint } from '@domain/iaAgentTools/backendCallEndpoint';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import type { MergeEffectiveIaAgentToolsOptions } from '@domain/iaAgentTools/backendToolDerivation';

/** GET/HEAD: body params → query string schema; altrimenti JSON body. */
function usesQueryParamsForMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

function defaultObjectSchema(): Record<string, unknown> {
  return { type: 'object', properties: {} };
}

/** Tipi JSON Schema ammessi su `query_params_schema.properties.*.type` (ElevenLabs). */
const ELEVENLABS_QUERY_PARAM_JSON_TYPES = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
]);

function jsonSchemaPrimitiveTypeFromProperty(src: Record<string, unknown>): string {
  const t = src.type;
  if (typeof t === 'string' && ELEVENLABS_QUERY_PARAM_JSON_TYPES.has(t)) return t;
  return 'string';
}

/** Valore singolo in `enum` / da normalizzare per string enum ConvAI EU. */
function enumMemberToElevenLabsString(v: unknown): string {
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string') return v;
  return String(v);
}

/**
 * ConvAI EU (`agents/create`): **enum è consentito solo con `type: "string"`** (value_error se enum + boolean).
 * Converte `enum` in array di stringhe e imposta `type: "string"`. Per boolean JSON nel modello sorgente usa
 * `"true"` / `"false"`; il backend Omnia (OpenAPI coerce) accetta ancora stringhe per `forceRefresh`.
 */
function adaptEnumsAndConstsForElevenLabsConvai(row: Record<string, unknown>): void {
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

/**
 * `request_body_schema.properties.*` (ConvAI EU): serve `description` e **`type`** JSON primitives per ogni
 * proprietà — solo `{ description }` produce `union_tag_not_found` sul discriminatore API ElevenLabs.
 */
function propertiesToElevenLabsParamDefs(
  props: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return {};
  const converted: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(props)) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const descRaw = src.description;
    const desc =
      typeof descRaw === 'string' && descRaw.trim().length > 0
        ? descRaw.trim()
        : `Parametro ${name}`;
    const row: Record<string, unknown> = {
      description: desc,
      type: jsonSchemaPrimitiveTypeFromProperty(src),
    };
    const enumRaw = src.enum;
    if (Array.isArray(enumRaw) && enumRaw.length > 0) {
      row.enum = enumRaw;
    }
    if (Object.prototype.hasOwnProperty.call(src, 'const')) {
      row.const = src.const;
    }
    adaptEnumsAndConstsForElevenLabsConvai(row);
    converted[name] = row;
  }
  return converted;
}

/**
 * `query_params_schema.properties.*`: ElevenLabs richiede sia metadati ConvAI (`description`) sia `type`
 * per ogni proprietà (422 se manca `type`).
 */
function propertiesToElevenLabsQueryParamDefs(
  props: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return {};
  const converted: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(props)) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const descRaw = src.description;
    const desc =
      typeof descRaw === 'string' && descRaw.trim().length > 0
        ? descRaw.trim()
        : `Parametro ${name}`;
    const row: Record<string, unknown> = {
      description: desc,
      type: jsonSchemaPrimitiveTypeFromProperty(src),
    };
    const enumRaw = src.enum;
    if (Array.isArray(enumRaw) && enumRaw.length > 0) {
      row.enum = enumRaw;
    }
    if (Object.prototype.hasOwnProperty.call(src, 'const')) {
      row.const = src.const;
    }
    adaptEnumsAndConstsForElevenLabsConvai(row);
    converted[name] = row;
  }
  return converted;
}

/**
 * `request_body_schema` ElevenLabs: object con `properties` convertite e `required` se presente nello schema.
 */
function toElevenLabsRequestBodySchema(inputSchema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: 'object',
    properties: propertiesToElevenLabsParamDefs(
      inputSchema.properties as Record<string, unknown> | undefined
    ),
  };
  const req = inputSchema.required;
  if (Array.isArray(req) && req.every((x) => typeof x === 'string')) {
    out.required = req;
  }
  return out;
}

/**
 * `QueryParamsJsonSchema`: solo `properties` + `required` — niente `type` in radice
 * (vedi errore API extra_forbidden su `query_params_schema.type`).
 * Ogni `properties.*`: `{ description, type }` (ConvAI + JSON Schema).
 */
function toElevenLabsQueryParamsSchema(inputSchema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    properties: propertiesToElevenLabsQueryParamDefs(
      inputSchema.properties as Record<string, unknown> | undefined
    ),
  };
  const req = inputSchema.required;
  if (Array.isArray(req) && req.every((x) => typeof x === 'string')) {
    out.required = req;
  }
  return out;
}

function dedupeElevenLabsToolNames(tools: Record<string, unknown>[]): Record<string, unknown>[] {
  const used = new Set<string>();
  return tools.map((t) => {
    let name = String(t.name ?? '').trim() || 'tool';
    const original = name;
    let k = 0;
    while (used.has(name)) {
      k += 1;
      name = sanitizeConvaiToolName(`${original}_${k}`);
    }
    used.add(name);
    return name === original ? t : { ...t, name };
  });
}

/**
 * Costruisce l’array `tools` per `conversation_config.agent.prompt` nel formato ElevenLabs API.
 */
export function buildElevenLabsConvaiPromptTools(
  cfg: IAAgentConfig,
  getTask: (taskId: string) => Task | null | undefined,
  options?: MergeEffectiveIaAgentToolsOptions
): Record<string, unknown>[] {
  const manual = Array.isArray(cfg.tools) ? cfg.tools : [];
  const fromCfg = Array.isArray(cfg.convaiBackendToolTaskIds)
    ? cfg.convaiBackendToolTaskIds.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const fromCatalog = options?.manualCatalogBackendTaskIds ?? [];
  const backendIds = mergeConvaiBackendToolIdLists(fromCfg, fromCatalog);

  const out: Record<string, unknown>[] = [];

  for (const m of manual) {
    const name = String(m.name ?? '').trim();
    const desc = String(m.description ?? '').trim();
    if (!name || !desc) continue;
    const params =
      m.inputSchema && typeof m.inputSchema === 'object'
        ? (m.inputSchema as Record<string, unknown>)
        : defaultObjectSchema();
    out.push({
      type: 'client',
      name,
      description: desc,
      parameters: params,
    });
  }

  for (const id of backendIds) {
    const t = getTask(id);
    if (!t || t.type !== TaskType.BackendCall) continue;
    const dr = deriveBackendToolDefinition(t);
    if (!dr.ok) continue;
    const { url, method, headers } = readBackendCallEndpoint(t);
    if (!url) continue;

    const apiSchema: Record<string, unknown> = {
      url,
      method,
    };
    if (Object.keys(headers).length > 0) {
      apiSchema.request_headers = headers;
    }
    const schema = dr.tool.inputSchema && typeof dr.tool.inputSchema === 'object'
      ? dr.tool.inputSchema
      : defaultObjectSchema();
    if (usesQueryParamsForMethod(method)) {
      apiSchema.query_params_schema = toElevenLabsQueryParamsSchema(schema);
    } else {
      apiSchema.request_body_schema = toElevenLabsRequestBodySchema(schema);
    }

    out.push({
      type: 'webhook',
      name: dr.tool.name,
      description: dr.tool.description,
      api_schema: apiSchema,
      response_timeout_secs: 20,
    });

    if (String(url).toLowerCase().includes('bookfromagenda')) {
      const bodySchema =
        method === 'GET' || method === 'HEAD'
          ? (apiSchema.query_params_schema as Record<string, unknown> | undefined)
          : (apiSchema.request_body_schema as Record<string, unknown> | undefined);
      const props =
        bodySchema && typeof bodySchema === 'object' && !Array.isArray(bodySchema)
          ? ((bodySchema.properties as Record<string, unknown> | undefined) ?? {})
          : {};
      const readFixed = (k: string): unknown[] =>
        props[k] && typeof props[k] === 'object' && !Array.isArray(props[k])
          ? (Array.isArray((props[k] as Record<string, unknown>).enum)
              ? (((props[k] as Record<string, unknown>).enum as unknown[]) ?? [])
              : Object.prototype.hasOwnProperty.call(props[k] as Record<string, unknown>, 'const')
                ? [((props[k] as Record<string, unknown>).const as unknown)]
                : [])
          : [];
      console.info('[IA·BookFromAgenda·ToolConfig]', {
        taskId: t.id,
        toolName: dr.tool.name,
        endpoint: url,
        fixedAgendaUrl: readFixed('agenda.url'),
        fixedAgendaType: readFixed('agenda.type'),
        fixedProjectId: readFixed('projectId'),
        fixedForceRefresh: readFixed('forceRefresh'),
        required: Array.isArray(bodySchema?.required) ? bodySchema.required : [],
      });
    }
  }

  return dedupeElevenLabsToolNames(out);
}

/** Diagnostica webhook post-tunnel: {@link collectConvaiWebhookDiagnosticsFromMergedTasks}. */
export {
  collectConvaiWebhookDiagnosticsFromMergedTasks,
  extractConvaiWebhookDiagnosticsFromConversationFragment,
} from './convaiWebhookToolDiagnostics';
