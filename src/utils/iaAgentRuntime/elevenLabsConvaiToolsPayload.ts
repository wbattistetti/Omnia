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
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import type { MergeEffectiveIaAgentToolsOptions } from '@domain/iaAgentTools/backendToolDerivation';

function normalizeHttpMethod(m: string | undefined): string {
  const u = (m || 'GET').toUpperCase();
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(u) ? u : 'GET';
}

function readBackendCallEndpoint(task: Task): {
  url: string;
  method: string;
  headers: Record<string, string>;
} {
  const ep = (task as Task & { endpoint?: { url?: string; method?: string; headers?: Record<string, string> } })
    .endpoint;
  const url = ep && typeof ep.url === 'string' ? ep.url.trim() : '';
  const method = normalizeHttpMethod(ep && typeof ep.method === 'string' ? ep.method : undefined);
  const raw = ep && typeof ep.headers === 'object' && ep.headers ? ep.headers : {};
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) headers[k] = v;
  }
  return { url, method, headers };
}

/** GET/HEAD: body params → query string schema; altrimenti JSON body. */
function usesQueryParamsForMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

function defaultObjectSchema(): Record<string, unknown> {
  return { type: 'object', properties: {} };
}

/**
 * ElevenLabs `QueryParamsJsonSchema`: solo `properties` + `required` — niente `type` in radice
 * (vedi errore API extra_forbidden su `query_params_schema.type`).
 */
function toElevenLabsQueryParamsSchema(inputSchema: Record<string, unknown>): Record<string, unknown> {
  const props = inputSchema.properties;
  const out: Record<string, unknown> = {};
  if (props && typeof props === 'object' && !Array.isArray(props)) {
    out.properties = props;
  } else {
    out.properties = {};
  }
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
      apiSchema.request_body_schema = schema;
    }

    out.push({
      type: 'webhook',
      name: dr.tool.name,
      description: dr.tool.description,
      api_schema: apiSchema,
      response_timeout_secs: 20,
    });
  }

  return dedupeElevenLabsToolNames(out);
}
