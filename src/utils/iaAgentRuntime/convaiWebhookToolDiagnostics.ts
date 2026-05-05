/**
 * Estrae diagnostica per tool ConvAI `webhook` da un `conversation_config` già processato
 * (es. dopo {@link conversationConfigForConvaiApi} per URL tunnel).
 */
import { loadDevTunnelPortMapFromStorage } from '@domain/devTunnel/devTunnelCompileBridge';
import type { FlowConvaiWebhookDiagnostic } from '@features/debugger/types/flowConvaiWebhookDiagnostic';
import { conversationConfigForConvaiApi, conversationConfigFragmentFromIaAgentConfig } from './convaiAgentCreatePayload';
import { iaAgentConfigWithEditorSystemPrompt } from './iaAgentConfigWithEditorSystemPrompt';
import { mergeResolvedAndLiveIaConfig, peekConvaiLiveIaConfig } from './convaiLiveIaConfigBridge';
import { resolveTaskIaConfig } from './resolveTaskIaConfig';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import type { Task } from '@types/taskTypes';

const LOCAL_RE = /https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)/gi;

function collectPortsInString(s: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  LOCAL_RE.lastIndex = 0;
  while ((m = LOCAL_RE.exec(s)) !== null) {
    const p = parseInt(m[1], 10);
    if (Number.isFinite(p)) out.push(p);
  }
  return out;
}

function analyzeUnreachable(endpoint: string): { unreachable: boolean; message?: string } {
  const ports = collectPortsInString(endpoint);
  if (ports.length === 0) return { unreachable: false };
  const map = loadDevTunnelPortMapFromStorage();
  const missing = [...new Set(ports)].filter((p) => !String(map[p] ?? '').trim());
  if (missing.length === 0) return { unreachable: false };
  return {
    unreachable: true,
    message: `Webhook non raggiungibile: porta/e locale/i ${missing.join(', ')} senza tunnel attivo (Impostazioni tunnel / ngrok).`,
  };
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
