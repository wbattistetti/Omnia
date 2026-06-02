/**
 * Estrae diagnostica per tool ConvAI `webhook` da un `conversation_config` già processato
 * (es. dopo {@link conversationConfigForConvaiApi} per URL tunnel).
 *
 * Gli errori di compilazione per tunnel mancante combinano: (1) URL nei tool dal fragment ConvAI,
 * (2) lettura diretta degli endpoint dei Backend Call referenziati — così non dipendiamo dalla sola
 * costruzione del `conversation_config` (che può fallire in silenzio se il prompt è incompleto).
 */
import type { CompilationError } from '@components/FlowCompiler/types';
import { analyzeLocalhostEndpointReachability } from '@domain/devTunnel/devTunnelCompileBridge';
import { deriveBackendToolDefinition } from '@domain/iaAgentTools/backendToolDerivation';
import { readBackendCallEndpoint } from '@domain/iaAgentTools/backendCallEndpoint';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import type { FlowConvaiWebhookDiagnostic } from '@features/debugger/types/flowConvaiWebhookDiagnostic';
import { conversationConfigForConvaiApi, conversationConfigFragmentFromIaAgentConfig } from './convaiAgentCreatePayload';
import { iaAgentConfigWithEditorSystemPrompt } from './iaAgentConfigWithEditorSystemPrompt';
import { mergeResolvedAndLiveIaConfig, peekConvaiLiveIaConfig } from './convaiLiveIaConfigBridge';
import { resolveTaskIaConfig } from './resolveTaskIaConfig';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import type { Task } from '@types/taskTypes';

function analyzeUnreachable(endpoint: string): { unreachable: boolean; message?: string } {
  const reach = analyzeLocalhostEndpointReachability(endpoint);
  return { unreachable: reach.unreachable, message: reach.message };
}

function dedupeConvaiWebhookDiagnostics(rows: FlowConvaiWebhookDiagnostic[]): FlowConvaiWebhookDiagnostic[] {
  const seen = new Set<string>();
  const out: FlowConvaiWebhookDiagnostic[] = [];
  for (const r of rows) {
    const k = `${r.sourceTaskId ?? ''}|${r.endpoint}|${r.method}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function resolveTaskFromMerged(mergedTasks: unknown[], id: string): Task | null {
  const fromRepo = taskRepository.getTask(id);
  if (fromRepo) return fromRepo;
  for (const raw of mergedTasks) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as Task;
    if (String(t.id ?? '') === id) return t;
  }
  return null;
}

/**
 * Backend Call referenziati come tool ConvAI (stessi id di {@link buildElevenLabsConvaiPromptTools}):
 * se l’endpoint è ancora localhost senza tunnel pubblico, diagnostica bloccante.
 */
function collectUnreachableBackendEndpointDiagnostics(
  mergedTasks: unknown[],
  manualCatalogBackendTaskIds: readonly string[]
): FlowConvaiWebhookDiagnostic[] {
  const out: FlowConvaiWebhookDiagnostic[] = [];

  for (const raw of mergedTasks) {
    try {
      if (!raw || typeof raw !== 'object') continue;
      const t = raw as Task & { id?: string };
      if (t.type !== TaskType.AIAgent || !t.id) continue;

      const task = taskRepository.getTask(t.id) ?? (t as Task);
      if (!task || task.type !== TaskType.AIAgent) continue;

      const resolved = resolveTaskIaConfig(task);
      const live = peekConvaiLiveIaConfig(task.id);
      const cfg = mergeResolvedAndLiveIaConfig(resolved, live);
      if (cfg.platform !== 'elevenlabs') continue;

      const fromCfg = Array.isArray(cfg.convaiBackendToolTaskIds)
        ? cfg.convaiBackendToolTaskIds.map((x) => String(x ?? '').trim()).filter(Boolean)
        : [];
      const backendIds = mergeConvaiBackendToolIdLists(fromCfg, [...manualCatalogBackendTaskIds]);

      for (const bid of backendIds) {
        const bt = resolveTaskFromMerged(mergedTasks, bid);
        if (!bt || bt.type !== TaskType.BackendCall) continue;
        const dr = deriveBackendToolDefinition(bt);
        if (!dr.ok) continue;
        const { url, method, headers } = readBackendCallEndpoint(bt);
        if (!url) continue;
        const reach = analyzeUnreachable(url);
        if (!reach.unreachable) continue;
        out.push({
          kind: 'convai_webhook',
          toolName: dr.tool.name,
          sourceTaskId: task.id,
          endpoint: url,
          method,
          headers,
          inputSchemaSummary: {},
          description: dr.tool.description,
          unreachable: true,
          errorMessage: reach.message,
        });
      }
    } catch {
      /* altro task */
    }
  }

  return out;
}

function readHeaders(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  return out;
}

/**
 * Legge `prompt.tools` dal frammento conversation_config (shape ElevenLabs).
 */
export function extractConvaiWebhookDiagnosticsFromConversationFragment(
  fragment: Record<string, unknown> | null | undefined,
  options?: { sourceTaskId?: string }
): FlowConvaiWebhookDiagnostic[] {
  if (!fragment || typeof fragment !== 'object') return [];
  const agent = fragment.agent as Record<string, unknown> | undefined;
  const prompt = agent?.prompt as Record<string, unknown> | undefined;
  const tools = prompt?.tools;
  if (!Array.isArray(tools)) return [];

  const out: FlowConvaiWebhookDiagnostic[] = [];
  for (const t of tools) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    if (String(o.type || '').toLowerCase() !== 'webhook') continue;
    const name = String(o.name ?? '').trim() || 'webhook';
    const desc = typeof o.description === 'string' ? o.description.trim() : undefined;
    const api = o.api_schema;
    if (!api || typeof api !== 'object' || Array.isArray(api)) continue;
    const schema = api as Record<string, unknown>;
    const url = typeof schema.url === 'string' ? schema.url.trim() : '';
    if (!url) continue;
    const method = typeof schema.method === 'string' ? schema.method.trim().toUpperCase() : 'GET';
    const headers = readHeaders(schema.request_headers);
    const body = schema.request_body_schema;
    const query = schema.query_params_schema;
    const reach = analyzeUnreachable(url);
    out.push({
      kind: 'convai_webhook',
      toolName: name,
      sourceTaskId: options?.sourceTaskId,
      endpoint: url,
      method,
      headers,
      inputSchemaSummary: {
        ...(body !== undefined ? { body } : {}),
        ...(query !== undefined ? { query } : {}),
      },
      description: desc,
      unreachable: reach.unreachable,
      errorMessage: reach.message,
    });
  }
  return out;
}

/**
 * Per ogni task AI Agent ElevenLabs nei task compilati: costruisce il conversation_config
 * effettivamente inviabile (con tunnel se attivo) e raccoglie i webhook.
 */
export function collectConvaiWebhookDiagnosticsFromMergedTasks(
  mergedTasks: unknown[],
  manualCatalogBackendTaskIds: readonly string[]
): FlowConvaiWebhookDiagnostic[] {
  const acc: FlowConvaiWebhookDiagnostic[] = [];
  const seen = new Set<string>();

  for (const raw of mergedTasks) {
    try {
      if (!raw || typeof raw !== 'object') continue;
      const t = raw as Task & { id?: string };
      if (t.type !== TaskType.AIAgent || !t.id) continue;

      const task = taskRepository.getTask(t.id) ?? (t as Task);
      if (!task || task.type !== TaskType.AIAgent) continue;

      const resolved = resolveTaskIaConfig(task);
      const live = peekConvaiLiveIaConfig(task.id);
      const cfg = mergeResolvedAndLiveIaConfig(resolved, live);
      if (cfg.platform !== 'elevenlabs') continue;

      let fragment: Record<string, unknown> | null = null;
      try {
        const cfgForCreate = iaAgentConfigWithEditorSystemPrompt(cfg, task, {
          manualCatalogBackendTaskIds,
        });
        fragment =
          conversationConfigFragmentFromIaAgentConfig(cfgForCreate, {
            omitTts: false,
            task,
            manualCatalogBackendTaskIds,
          }) ?? null;
      } catch {
        continue;
      }
      if (!fragment) continue;

      const outbound = conversationConfigForConvaiApi(fragment) ?? fragment;
      const rows = extractConvaiWebhookDiagnosticsFromConversationFragment(outbound, {
        sourceTaskId: task.id,
      });
      for (const row of rows) {
        const key = `${row.toolName}|${row.endpoint}|${row.method}`;
        if (seen.has(key)) continue;
        seen.add(key);
        acc.push(row);
      }
    } catch {
      /* task singolo non blocca gli altri */
    }
  }

  return acc;
}

/**
 * Converte diagnostiche webhook con `unreachable: true` (localhost senza mappa tunnel) in errori di compilazione.
 * Usato dal compilatore orchestrator: ElevenLabs non può POSTare su localhost del dev senza URL pubblico (ngrok).
 *
 * Indipendente da «Compilazione con tunnel»: quel flag controlla solo {@link collectDevTunnelCompileErrors}.
 */
export function convaiWebhookDiagnosticsToTunnelCompileErrors(
  diagnostics: FlowConvaiWebhookDiagnostic[]
): CompilationError[] {
  const unreachable = diagnostics.filter((d) => d.unreachable);
  if (!unreachable.length) return [];

  const byTask = new Map<string, { tools: string[]; endpoints: Set<string> }>();
  for (const d of unreachable) {
    const tid = d.sourceTaskId?.trim();
    if (!tid) continue;
    const ep = (d.endpoint ?? '').trim();
    if (!byTask.has(tid)) {
      byTask.set(tid, { tools: [d.toolName], endpoints: new Set(ep ? [ep] : []) });
    } else {
      const cur = byTask.get(tid)!;
      cur.tools.push(d.toolName);
      if (ep) cur.endpoints.add(ep);
    }
  }

  const out: CompilationError[] = [];
  for (const [taskId, { endpoints }] of byTask) {
    const endpointList = [...endpoints].sort((a, b) => a.localeCompare(b, 'it'));
    const message =
      endpointList.length > 0
        ? `Per questo task, questi indirizzi hanno bisogno di tunnel:\n\n${endpointList.join('\n')}`
        : 'Per questo task servono indirizzi raggiungibili dall’esterno tramite tunnel. Apri Impostazioni → Tunnel, configura ngrok sulla porta di Omnia e ricompila.';
    out.push({
      taskId,
      message,
      severity: 'Error',
      category: 'DevTunnel',
      code: 'ConvaiWebhookLocalhostTunnelMissing',
      fixTarget: { type: 'task', taskId },
      technicalDetail: endpointList.length ? endpointList.join('\n') : undefined,
      convaiWebhookTunnelUrls: endpointList,
    });
  }
  return out;
}

/**
 * Errori di compilazione se un AI Agent ElevenLabs espone webhook verso localhost senza voce in mappa tunnel.
 * Indipendente da «Compilazione con tunnel» ({@link collectDevTunnelCompileErrors}).
 */
export function collectConvaiWebhookTunnelCompileErrors(
  mergedTasks: unknown[],
  manualCatalogBackendTaskIds: readonly string[]
): CompilationError[] {
  const fromConversation = collectConvaiWebhookDiagnosticsFromMergedTasks(
    mergedTasks,
    manualCatalogBackendTaskIds
  );
  const fromBackendEndpoints = collectUnreachableBackendEndpointDiagnostics(
    mergedTasks,
    manualCatalogBackendTaskIds
  );
  const merged = dedupeConvaiWebhookDiagnostics([...fromConversation, ...fromBackendEndpoints]);
  return convaiWebhookDiagnosticsToTunnelCompileErrors(merged);
}
