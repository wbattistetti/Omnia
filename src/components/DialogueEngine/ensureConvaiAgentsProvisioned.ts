/**
 * Pre-compile ConvAI ElevenLabs: ogni Run elimina agenti con `__GUID_{taskId}` + crea un agente nuovo
 * (nome `OMNIA_<client>_<progetto>_<versione>_…__GUID_<taskId>`), dopo validazione tool backend.
 * `agent_id` resta solo in {@link convaiSessionAgentStore} (non nel DB).
 */

import type { Node } from 'reactflow';
import type { FlowNode } from '../Flowchart/types/flowTypes';
import { enrichRowsWithTaskId } from '../../utils/taskHelpers';
import { taskRepository } from '../../services/TaskRepository';
import { TaskType } from '../../types/taskTypes';
import {
  CreateConvaiAgentHttpError,
  createConvaiAgentViaOmniaServer,
  deleteConvaiAgentViaOmniaServer,
  listAllConvaiAgentsMatchingTaskGuid,
} from '../../services/convaiProvisionApi';
import {
  buildConvaiProvisionKey,
  conversationConfigForConvaiApi,
  conversationConfigFragmentFromIaAgentConfig,
} from '../../utils/iaAgentRuntime/convaiAgentCreatePayload';
import { buildConvaiAgentDisplayName } from '../../utils/iaAgentRuntime/convaiAgentDisplayName';
import { iaAgentConfigWithEditorSystemPrompt } from '../../utils/iaAgentRuntime/iaAgentConfigWithEditorSystemPrompt';
import { resolveTaskIaConfig } from '../../utils/iaAgentRuntime/resolveTaskIaConfig';
import {
  mergeResolvedAndLiveIaConfig,
  peekConvaiLiveIaConfig,
} from '../../utils/iaAgentRuntime/convaiLiveIaConfigBridge';
import { setConvaiSessionBinding } from '../../utils/iaAgentRuntime/convaiSessionAgentStore';
import type { NormalizedIaProviderError } from '@domain/compileErrors/iaProviderErrors';
import { normalizeProviderError } from '@domain/compileErrors/normalizeProviderError';
import { setIaProvisioningError } from '@domain/compileErrors/iaProvisioningErrorStore';
import { buildUseCaseDialoguesPreviewFromTask } from '@utils/iaAgentRuntime/agentUseCasesProvisionPreviewFormat';
import {
  emitConvaiProvisionPayloadPreview,
  isConvaiPayloadPreviewOnRunDebugEnabled,
  type ConvaiProvisionPayloadPreviewItem,
} from '@utils/iaAgentRuntime/convaiPayloadPreviewEvents';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { collectReachableBackendCallTaskIdsFromFlow } from '@domain/iaAgentTools/collectReachableBackendCallTaskIdsFromFlow';
import { readBackendCallEndpoint } from '@domain/iaAgentTools/backendCallEndpoint';

/** Contesto per il nome leggibile ElevenLabs (OMNIA… + GUID) e validazione tool. */
export type ConvaiProvisionContext = {
  projectLabel: string;
  rootFlowLabel: string;
  /** taskId → etichetta nodo canvas */
  nodeLabelByTaskId: Record<string, string>;
  /** Allinea payload/tool alla tab Backends (`backendCatalog.manualEntries`). */
  manualCatalogBackendTaskIds?: readonly string[];
  /** ProjectData.clientName / ownerClient — prefisso deterministico agent name. */
  omniaClientLabel?: string;
  /** ProjectData.version */
  omniaVersionLabel?: string;
  /** Grafo corrente per reachability Backend Call vs lista tool vuota. */
  flowSlice?: { nodes: unknown[]; edges: unknown[] };
};

/**
 * Se `false`, `conversation_config.tts` (voice_id + model_id) è incluso nel create quando la runtime
 * ha una voce primaria — allineato alla UI Agent setup. Su alcuni cluster EU un voice_id non valido
 * può causare 422 da ElevenLabs; in quel caso verificare voce/catalogo o residency.
 */
const OMIT_TTS_ON_CREATE = false;

function newSessionConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `omnia_conv_${crypto.randomUUID()}`;
  }
  return `omnia_conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isLikelyVariableRef(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
}

function readFixedInputLiteral(task: unknown, apiParam: string): string | null {
  const rows = (task as { inputs?: unknown[] })?.inputs;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const api = String((row as { apiParam?: string }).apiParam ?? '').trim();
    if (api !== apiParam) continue;
    const variable = String((row as { variable?: string }).variable ?? '').trim();
    if (!variable || isLikelyVariableRef(variable)) continue;
    return variable;
  }
  return null;
}

/**
 * ConvAI EU: `enum` è valido solo con `type: "string"` (non boolean + enum).
 * `logicalKind` `'boolean'` serializza i valori come `"true"` / `"false"`.
 */
function setSchemaPropertyEnum(
  properties: Record<string, unknown>,
  required: Set<string>,
  key: string,
  logicalKind: 'string' | 'boolean',
  values: unknown[]
): void {
  const prev =
    properties[key] && typeof properties[key] === 'object' && !Array.isArray(properties[key])
      ? (properties[key] as Record<string, unknown>)
      : {};
  const enumValues =
    logicalKind === 'boolean'
      ? values.map((v) => {
          if (v === true) return 'true';
          if (v === false) return 'false';
          return v;
        })
      : values;
  properties[key] = {
    ...prev,
    type: 'string',
    enum: enumValues,
  };
  required.add(key);
}

function enforceBookFromAgendaRuntimeToolPolicy(
  conversationConfigOutbound: Record<string, unknown>,
  fixed: { agendaUrl: string | null; agendaType: string | null; projectId: string | null; forceRefresh: boolean | null },
  sessionConversationId: string
): void {
  const agent = (conversationConfigOutbound.agent ?? null) as Record<string, unknown> | null;
  const prompt = (agent?.prompt ?? null) as Record<string, unknown> | null;
  const tools = Array.isArray(prompt?.tools) ? prompt!.tools : [];
  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') continue;
    const t = tool as Record<string, unknown>;
    if (String(t.type ?? '').toLowerCase() !== 'webhook') continue;
    const apiSchema =
      t.api_schema && typeof t.api_schema === 'object' && !Array.isArray(t.api_schema)
        ? (t.api_schema as Record<string, unknown>)
        : null;
    if (!apiSchema) continue;
    const webhookUrl = String(apiSchema.url ?? '').toLowerCase();
    if (!webhookUrl.includes('bookfromagenda')) continue;
    const method = String(apiSchema.method ?? 'POST').toUpperCase();
    const bodyOrQuery =
      method === 'GET' || method === 'HEAD'
        ? (apiSchema.query_params_schema as Record<string, unknown> | undefined)
        : (apiSchema.request_body_schema as Record<string, unknown> | undefined);
    if (!bodyOrQuery || typeof bodyOrQuery !== 'object' || Array.isArray(bodyOrQuery)) continue;
    const properties =
      bodyOrQuery.properties && typeof bodyOrQuery.properties === 'object' && !Array.isArray(bodyOrQuery.properties)
        ? ({ ...(bodyOrQuery.properties as Record<string, unknown>) } as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const required = new Set<string>(
      Array.isArray(bodyOrQuery.required)
        ? bodyOrQuery.required.filter((x): x is string => typeof x === 'string')
        : []
    );

    // Runtime session id controlled by Omnia, never invented by LLM.
    setSchemaPropertyEnum(properties, required, 'conversationId', 'string', [sessionConversationId]);
    // LLM follow-up should read snapshot; first refresh is handled by Omnia warm-up.
    setSchemaPropertyEnum(properties, required, 'forceRefresh', 'boolean', [false]);

    if (fixed.projectId && fixed.projectId.trim()) {
      setSchemaPropertyEnum(properties, required, 'projectId', 'string', [fixed.projectId.trim()]);
    }
    if (fixed.agendaUrl && fixed.agendaUrl.trim()) {
      setSchemaPropertyEnum(properties, required, 'agenda.url', 'string', [fixed.agendaUrl.trim()]);
    }
    const agendaType = (fixed.agendaType || 'Omnia').trim();
    if (agendaType) {
      setSchemaPropertyEnum(properties, required, 'agenda.type', 'string', [agendaType]);
    }

    if (fixed.agendaUrl && fixed.agendaUrl.trim()) {
      required.add('agenda.url');
      required.add('agenda.type');
    }

    const qcPrev = properties['queryConstraints'];
    const qcPrevObj =
      qcPrev && typeof qcPrev === 'object' && !Array.isArray(qcPrev)
        ? ({ ...(qcPrev as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    delete qcPrevObj.additionalProperties;
    const qcDescPrev =
      typeof qcPrevObj.description === 'string' && qcPrevObj.description.trim().length > 0
        ? qcPrevObj.description.trim()
        : '';
    properties['queryConstraints'] = {
      ...qcPrevObj,
      type: 'object',
      description: qcDescPrev
        ? `${qcDescPrev} Invia come oggetto JSON, non come stringa.`
        : 'Vincoli query (oggetto JSON). Non inviare una stringa serializzata.',
    };

    bodyOrQuery.properties = properties;
    bodyOrQuery.required = [...required];

    console.info('[IA·BookFromAgenda·ToolPolicy]', {
      toolName: String(t.name ?? ''),
      endpoint: apiSchema.url,
      sessionConversationId,
      fixedAgendaUrl: fixed.agendaUrl ? '[fixed]' : '(none)',
      fixedAgendaType: agendaType || '(none)',
      fixedProjectId: fixed.projectId ? '[fixed]' : '(none)',
      llmForceRefresh: false,
      required: bodyOrQuery.required,
    });
  }
}

async function warmupBookFromAgendaSnapshot(
  backendTask: unknown,
  payload: { conversationId: string; projectId: string; agendaUrl: string; agendaType: string }
): Promise<void> {
  const { url } = readBackendCallEndpoint(backendTask as never);
  if (!url.trim()) throw new Error('warmup skipped: backend endpoint url vuoto');
  const body = {
    'agenda.url': payload.agendaUrl,
    'agenda.type': payload.agendaType,
    conversationId: payload.conversationId,
    projectId: payload.projectId,
    forceRefresh: true,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`warmup HTTP ${res.status} ${text}`.trim());
  }
  console.info('[IA·BookFromAgenda·Warmup]', {
    endpoint: url,
    conversationId: payload.conversationId,
    projectId: payload.projectId,
    agendaUrl: payload.agendaUrl,
    agendaType: payload.agendaType,
    status: res.status,
  });
}

/**
 * Per ogni task AI Agent ElevenLabs sul canvas: sempre DELETE mirato su `__GUID_{taskId}` + CREATE
 * (nessuno skip per provision key: ogni Run crea un agente nuovo allineato ai backend correnti).
 */
export async function ensureConvaiAgentsProvisioned(
  nodes: Node<FlowNode>[],
  context: ConvaiProvisionContext
): Promise<{
  provisioned: string[];
  skipped: string[];
  failed: string[];
  /** Stesso id del tool webhook BookFromAgenda (`omnia_conv_…`); va inviato a startAgent come sessionAlias. */
  sessionConversationId: string;
}> {
  const enriched = nodes.map((node) => ({
    ...node,
    data: { ...node.data, rows: enrichRowsWithTaskId(node.data?.rows || []) },
  }));

  const seen = new Set<string>();
  const provisioned: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  const projectSlug = String(context.projectLabel || 'project').trim() || 'project';
  const flowSlug = String(context.rootFlowLabel || 'flow').trim() || 'flow';
  const payloadPreviewItems: ConvaiProvisionPayloadPreviewItem[] = [];
  const sessionConversationId = newSessionConversationId();

  for (const node of enriched) {
    const rows = node.data?.rows || [];
    for (const row of rows) {
      const taskId = String(row.id || row.taskId || '').trim();
      if (!taskId || seen.has(taskId)) continue;
      seen.add(taskId);

      const task = taskRepository.getTask(taskId);
      if (!task || task.type !== TaskType.AIAgent) continue;

      const resolved = resolveTaskIaConfig(task);
      const live = peekConvaiLiveIaConfig(taskId);
      const cfg = mergeResolvedAndLiveIaConfig(resolved, live);
      if (cfg.platform !== 'elevenlabs') continue;

      const manualCatalogBackendTaskIds = context.manualCatalogBackendTaskIds ?? [];
      const cfgForCreate = iaAgentConfigWithEditorSystemPrompt(cfg, task, {
        manualCatalogBackendTaskIds,
      });
      let provisionKey: string;
      try {
        provisionKey = buildConvaiProvisionKey(cfgForCreate, task, OMIT_TTS_ON_CREATE, {
          manualCatalogBackendTaskIds,
        });
      } catch {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'provisionKey',
          message: 'ConvAI: prompt vuoto o runtime non valido per il task.',
          raw: null,
        });
        continue;
      }
      if (!provisionKey) {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'provisionKey',
          message: 'ConvAI: impossibile calcolare la chiave di provision.',
          raw: null,
        });
        continue;
      }

      const fromCfg = (cfgForCreate.convaiBackendToolTaskIds ?? [])
        .map((x) => String(x || '').trim())
        .filter(Boolean);
      const effectiveBackendIds = mergeConvaiBackendToolIdLists(fromCfg, [...manualCatalogBackendTaskIds]);
      const effectiveBackendTasks = effectiveBackendIds
        .map((id) => taskRepository.getTask(id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t) && t!.type === TaskType.BackendCall);
      let backendToolValidationFailed = false;
      for (const bid of effectiveBackendIds) {
        const bt = taskRepository.getTask(bid);
        if (!bt || bt.type !== TaskType.BackendCall) {
          failed.push(taskId);
          setIaProvisioningError(taskId, {
            provider: 'elevenlabs',
            code: 'backendToolTaskMissing',
            message: `ConvAI: id tool backend «${bid.slice(0, 8)}…» non trovato nel progetto o non è un Backend Call.`,
            raw: { bid },
          });
          backendToolValidationFailed = true;
          break;
        }
      }
      if (backendToolValidationFailed) continue;

      const reachableBackendIds = collectReachableBackendCallTaskIdsFromFlow(
        context.flowSlice ?? null,
        taskId
      );
      if (reachableBackendIds.length > 0 && effectiveBackendIds.length === 0) {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'convaiBackendToolIdsEmpty',
          message:
            'ConvAI: nessun tool backend in elenco (`convaiBackendToolTaskIds` / catalogo) ma il flusso ha Backend Call raggiungibili dall’agente.',
          raw: null,
        });
        continue;
      }

      const nodeLabel =
        context.nodeLabelByTaskId[taskId] ||
        String(node.data?.label || node.data?.text || 'node').trim() ||
        'node';

      let displayName: string;
      try {
        displayName = buildConvaiAgentDisplayName({
          projectLabel: projectSlug,
          flowLabel: flowSlug,
          nodeLabel,
          taskGuid: taskId,
          omniaClientLabel: context.omniaClientLabel,
          omniaVersionLabel: context.omniaVersionLabel,
        });
      } catch (e) {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'displayName',
          message: e instanceof Error ? e.message : String(e),
          raw: e,
        });
        continue;
      }

      let fragment: Record<string, unknown>;
      try {
        fragment = conversationConfigFragmentFromIaAgentConfig(cfgForCreate, {
          omitTts: OMIT_TTS_ON_CREATE,
          task,
          manualCatalogBackendTaskIds,
        })!;
      } catch (buildErr) {
        failed.push(taskId);
        setIaProvisioningError(taskId, {
          provider: 'elevenlabs',
          code: 'conversationConfig',
          message: buildErr instanceof Error ? buildErr.message : String(buildErr),
          raw: buildErr,
        });
        continue;
      }

      const conversationConfigOutbound =
        conversationConfigForConvaiApi(fragment) ?? fragment;
      const bookFromAgendaTask = effectiveBackendTasks.find((bt) =>
        String(readBackendCallEndpoint(bt as never).url ?? '')
          .toLowerCase()
          .includes('bookfromagenda')
      );
      const fixedAgendaUrl = bookFromAgendaTask ? readFixedInputLiteral(bookFromAgendaTask, 'agenda.url') : null;
      const fixedAgendaType = bookFromAgendaTask ? readFixedInputLiteral(bookFromAgendaTask, 'agenda.type') : null;
      const fixedProjectId = bookFromAgendaTask ? readFixedInputLiteral(bookFromAgendaTask, 'projectId') : null;
      const fixedForceRefreshRaw = bookFromAgendaTask ? readFixedInputLiteral(bookFromAgendaTask, 'forceRefresh') : null;
      const fixedForceRefresh =
        fixedForceRefreshRaw != null
          ? (fixedForceRefreshRaw.toLowerCase() === 'true' || fixedForceRefreshRaw === '1'
              ? true
              : fixedForceRefreshRaw.toLowerCase() === 'false' || fixedForceRefreshRaw === '0'
                ? false
                : null)
          : null;
      if (bookFromAgendaTask) {
        enforceBookFromAgendaRuntimeToolPolicy(
          conversationConfigOutbound as Record<string, unknown>,
          {
            agendaUrl: fixedAgendaUrl,
            agendaType: fixedAgendaType,
            projectId: fixedProjectId,
            forceRefresh: fixedForceRefresh,
          },
          sessionConversationId
        );
      }

      let previewEntry: ConvaiProvisionPayloadPreviewItem | undefined;
      try {
        const matches = await listAllConvaiAgentsMatchingTaskGuid(taskId);
        for (const m of matches) {
          try {
            await deleteConvaiAgentViaOmniaServer(m.agentId);
          } catch (delErr) {
            console.warn('[IA·ConvAI] delete agent (cleanup) failed, continue', {
              taskId,
              agentId: m.agentId,
              error: delErr instanceof Error ? delErr.message : String(delErr),
            });
          }
        }

        {
          const requestBody: Record<string, unknown> = {};
          const n = displayName.trim();
          if (n) requestBody.name = n;
          requestBody.conversation_config = conversationConfigOutbound;
          previewEntry = {
            taskId,
            displayName,
            bodyText: JSON.stringify(requestBody, null, 2),
            useCaseDialoguesPreview: buildUseCaseDialoguesPreviewFromTask(task),
          };
          payloadPreviewItems.push(previewEntry);
        }
        const result = await createConvaiAgentViaOmniaServer({
          name: displayName,
          conversation_config: conversationConfigOutbound,
        });
        if (previewEntry && result.elevenLabsRequestJson?.trim()) {
          previewEntry.bodyText = result.elevenLabsRequestJson.trim();
        }

        setConvaiSessionBinding(taskId, result.agentId, provisionKey);
        if (bookFromAgendaTask) {
          if (!fixedAgendaUrl || !fixedProjectId) {
            console.warn('[IA·BookFromAgenda·Warmup] skipped (missing fixed literals)', {
              taskId,
              hasAgendaUrl: Boolean(fixedAgendaUrl),
              hasProjectId: Boolean(fixedProjectId),
              sessionConversationId,
            });
          } else {
            try {
              await warmupBookFromAgendaSnapshot(bookFromAgendaTask, {
                conversationId: sessionConversationId,
                projectId: fixedProjectId,
                agendaUrl: fixedAgendaUrl,
                agendaType: (fixedAgendaType || 'Omnia').trim() || 'Omnia',
              });
            } catch (warmErr) {
              console.warn('[IA·BookFromAgenda·Warmup] failed (continue)', {
                taskId,
                error: warmErr instanceof Error ? warmErr.message : String(warmErr),
              });
            }
          }
        }
        provisioned.push(taskId);
        setIaProvisioningError(taskId, null);
      } catch (err) {
        if (
          previewEntry &&
          err instanceof CreateConvaiAgentHttpError &&
          err.elevenLabsRequestJson?.trim()
        ) {
          previewEntry.bodyText = err.elevenLabsRequestJson.trim();
        }
        failed.push(taskId);
        const normalized: NormalizedIaProviderError =
          normalizeProviderError(err) ?? {
            provider: 'unknown',
            code: 'raw',
            message: err instanceof Error ? err.message : String(err),
            raw: err,
          };
        setIaProvisioningError(taskId, normalized);
        console.error('[IA·ConvAI] provision failed', {
          taskId,
          error: err instanceof Error ? err.message : String(err),
          normalized,
        });
      }
    }
  }

  if (payloadPreviewItems.length > 0) {
    emitConvaiProvisionPayloadPreview(payloadPreviewItems);
  } else if (isConvaiPayloadPreviewOnRunDebugEnabled()) {
    emitConvaiProvisionPayloadPreview([
      {
        taskId: 'convai-preview-no-elevenlabs-tasks',
        displayName: 'ConvAI — nessun task da provisionare',
        bodyText:
          '// Debug Run: nessun task AI Agent con piattaforma ElevenLabs nel flusso passato a ensureConvaiAgentsProvisioned.\n' +
          '// Il pannello è mostrato in sviluppo (import.meta.env.DEV) o con localStorage omnia.debug.convaiPayloadOnRun=1.\n' +
          '// Per non aprirlo in dev: localStorage.setItem("omnia.debug.convaiPayloadOnRun", "0").',
      },
    ]);
  }

  return { provisioned, skipped, failed, sessionConversationId };
}
