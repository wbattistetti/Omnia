/**
 * ElevenLabs ConvAI accetta in `conversation_config.agent.prompt.tools` solo tipi
 * `webhook`, `client`, `api_integration_webhook`, ecc. — non il formato OpenAI `type: function`.
 * I Backend Call Omnia diventano tool `webhook` con `api_schema`; i tool manuali in `cfg.tools` → `client`.
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import {
  toElevenLabsQueryParamsSchema,
  toElevenLabsRequestBodySchema,
} from '@domain/openApi/adaptOpenApiJsonSchemaToElevenLabsToolSchema';
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

export type BuildConvaiWebhookFromBackendTaskResult =
  | { ok: true; tool: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Un singolo tool `webhook` ConvAI da Backend Call (stesso payload di {@link buildElevenLabsConvaiPromptTools}).
 */
export function buildConvaiWebhookToolFromBackendTask(
  task: Task
): BuildConvaiWebhookFromBackendTaskResult {
  if (task.type !== TaskType.BackendCall) {
    return { ok: false, error: 'Il task non è un Backend Call.' };
  }
  const dr = deriveBackendToolDefinition(task);
  if (!dr.ok) return { ok: false, error: dr.error };
  const { url, method, headers } = readBackendCallEndpoint(task);
  if (!url.trim()) {
    return { ok: false, error: 'URL operativo obbligatorio sul Backend Call.' };
  }

  const apiSchema: Record<string, unknown> = { url, method };
  if (Object.keys(headers).length > 0) {
    apiSchema.request_headers = headers;
  }
  const schema =
    dr.tool.inputSchema && typeof dr.tool.inputSchema === 'object'
      ? dr.tool.inputSchema
      : defaultObjectSchema();
  if (usesQueryParamsForMethod(method)) {
    apiSchema.query_params_schema = toElevenLabsQueryParamsSchema(schema);
  } else {
    apiSchema.request_body_schema = toElevenLabsRequestBodySchema(schema);
  }

  const tool: Record<string, unknown> = {
    type: 'webhook',
    name: dr.tool.name,
    description: dr.tool.description,
    api_schema: apiSchema,
    response_timeout_secs: 20,
  };
  const [deduped] = dedupeElevenLabsToolNames([tool]);
  return { ok: true, tool: deduped ?? tool };
}

/** Diagnostica webhook post-tunnel: {@link collectConvaiWebhookDiagnosticsFromMergedTasks}. */
export {
  collectConvaiWebhookDiagnosticsFromMergedTasks,
  extractConvaiWebhookDiagnosticsFromConversationFragment,
} from './convaiWebhookToolDiagnostics';
