/**
 * Tool webhook ConvAI solo inline su `prompt.tools` (nessun POST workspace /convai/tools).
 */

import { getConvaiAgentDetail, patchConvaiAgent } from '@workspaces/elevenlabs/api/convaiAgentApi';
import type { ConvaiAgentSyncParams } from '@domain/convai/convaiAgentSyncTypes';
import type { ConvaiAgentSyncToolResult } from '@domain/convai/convaiAgentSyncTypes';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import {
  prepareConvaiWebhookToolForElevenLabsApi,
  resolveConvaiSyncBackendTaskIds,
} from './prepareConvaiWebhookToolForElevenLabsApi';
import { sanitizeConvaiWebhookToolForApi } from '@domain/openApi/sanitizeConvaiWebhookToolForApi';
import {
  isKbDeterministicDeployMode,
  normalizeAgentConvaiDeployMode,
} from '@domain/convai/agentConvaiDeployMode';
import { rewriteCompilePayloadWithDevTunnel } from '@domain/devTunnel/devTunnelCompileBridge';
import {
  buildOmniaDialogStepConvaiTool,
  isOmniaDialogStepConvaiTool,
  OMNIA_DIALOG_STEP_TOOL_NAME,
} from './omniaDialogStepConvaiTool';
import { collectKbDialogSlotColumnIds } from '@domain/convai/kbDialogSlotMapPrompt';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Legge i tool inline da conversation_config ElevenLabs. */
export function readRawInlineToolsFromConversationConfig(
  conversationConfig: unknown
): Record<string, unknown>[] {
  const cc = asRecord(conversationConfig);
  const agent = asRecord(cc?.agent);
  const prompt = asRecord(agent?.prompt);
  const toolsRaw = prompt?.tools;
  if (!Array.isArray(toolsRaw)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of toolsRaw) {
    const row = asRecord(item);
    if (row) out.push(row);
  }
  return out;
}

/** Sostituisce tool inline con lo stesso `name`, mantiene gli altri. */
export function mergeInlineWebhookToolsByName(
  existing: readonly Record<string, unknown>[],
  next: Record<string, unknown>
): Record<string, unknown>[] {
  const name = String(next.name ?? '').trim();
  const rest = existing.filter((t) => String(t.name ?? '').trim() !== name);
  return [...rest, next];
}

/**
 * Costruisce payload tool inline per ogni backend del sync (senza creare voci workspace).
 */
export async function buildConvaiInlineWebhookToolsForSync(params: {
  backendIds: readonly string[];
  projectId: string;
  agentTaskId: string;
  useDevTunnel: boolean;
}): Promise<
  | { ok: true; tools: ConvaiAgentSyncToolResult[]; inlinePayloads: Record<string, unknown>[] }
  | { ok: false; message: string; backendTaskId?: string }
> {
  const inlinePayloads: Record<string, unknown>[] = [];
  const tools: ConvaiAgentSyncToolResult[] = [];

  for (const bid of params.backendIds) {
    const bt = taskRepository.getTask(bid);
    if (!bt || bt.type !== TaskType.BackendCall) {
      return { ok: false, message: `Backend «${bid}» non trovato.`, backendTaskId: bid };
    }
    const built = prepareConvaiWebhookToolForElevenLabsApi({
      backendTask: bt,
      projectId: params.projectId,
      agentTaskId: params.agentTaskId,
      useDevTunnel: params.useDevTunnel,
    });
    if (!built.ok) {
      return { ok: false, message: built.error, backendTaskId: bid };
    }
    inlinePayloads.push(built.tool);
    const toolName = String(built.tool.name ?? '').trim() || bid;
    tools.push({
      backendTaskId: bid,
      toolId: bid,
      toolName,
    });
  }

  return { ok: true, tools, inlinePayloads };
}

/** Wrapper che risolve gli id backend dal task agente. */
export async function buildConvaiInlineWebhookToolsFromSyncParams(
  params: ConvaiAgentSyncParams & { useDevTunnel: boolean }
): Promise<
  | { ok: true; tools: ConvaiAgentSyncToolResult[]; inlinePayloads: Record<string, unknown>[] }
  | { ok: false; message: string; backendTaskId?: string }
> {
  const backendIds = resolveConvaiSyncBackendTaskIds(params);
  const built = await buildConvaiInlineWebhookToolsForSync({
    backendIds,
    projectId: String(params.projectId ?? '').trim(),
    agentTaskId: String(params.agentTask.id ?? '').trim(),
    useDevTunnel: params.useDevTunnel,
  });
  if (!built.ok) return built;

  const deployMode = normalizeAgentConvaiDeployMode(params.agentTask.agentConvaiDeployMode);
  if (!isKbDeterministicDeployMode(deployMode)) return built;

  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(params.agentTask.id ?? '').trim();
  if (!projectId || !agentTaskId) return built;

  let dialogTool = buildOmniaDialogStepConvaiTool({
    projectId,
    agentTaskId,
    slotColumnIds: collectKbDialogSlotColumnIds(params.agentTask.agentKnowledgeBaseDocumentsJson),
  });
  if (params.useDevTunnel) {
    dialogTool = rewriteCompilePayloadWithDevTunnel(dialogTool) as Record<string, unknown>;
  }
  dialogTool = sanitizeConvaiWebhookToolForApi(dialogTool);
  const inlinePayloads = [
    ...built.inlinePayloads.filter((t) => !isOmniaDialogStepConvaiTool(t)),
    dialogTool,
  ];
  const tools: ConvaiAgentSyncToolResult[] = [
    ...built.tools.filter((t) => t.toolName !== OMNIA_DIALOG_STEP_TOOL_NAME),
    {
      backendTaskId: 'omnia_dialog_step',
      toolId: 'omnia_dialog_step',
      toolName: OMNIA_DIALOG_STEP_TOOL_NAME,
    },
  ];
  return { ok: true, tools, inlinePayloads };
}

/** ElevenLabs PATCH: non ammette `tools` e `tool_ids` insieme — solo inline tools. */
export function stripPromptToolIdsForInlineToolsPatch(
  conversationConfigOutbound: Record<string, unknown>
): void {
  const agent = (conversationConfigOutbound.agent ?? {}) as Record<string, unknown>;
  const prompt = (agent.prompt ?? {}) as Record<string, unknown>;
  prompt.tool_ids = [];
  agent.prompt = prompt;
  conversationConfigOutbound.agent = agent;
}

/**
 * PATCH agente: tool solo inline, `tool_ids` svuotato (nessun riferimento workspace).
 */
export async function patchConvaiAgentInlineWebhookTools(
  agentId: string,
  inlineTools: readonly Record<string, unknown>[]
): Promise<void> {
  const id = String(agentId || '').trim();
  if (!id) throw new Error('patchConvaiAgentInlineWebhookTools: agentId obbligatorio.');

  const sanitized = inlineTools.map((t) => sanitizeConvaiWebhookToolForApi(t));

  await patchConvaiAgent(id, {
    conversation_config: {
      agent: {
        prompt: {
          tools: sanitized,
          tool_ids: [],
        },
      },
    },
  });
}

/**
 * Aggiorna o aggiunge un singolo tool inline sull’agente (publish backend).
 */
export async function upsertInlineWebhookToolOnAgent(
  agentId: string,
  toolPayload: Record<string, unknown>
): Promise<void> {
  const id = String(agentId || '').trim();
  if (!id) throw new Error('upsertInlineWebhookToolOnAgent: agentId obbligatorio.');

  const detail = await getConvaiAgentDetail(id);
  const existing = readRawInlineToolsFromConversationConfig(detail.conversationConfig);
  const merged = mergeInlineWebhookToolsByName(existing, toolPayload);
  await patchConvaiAgentInlineWebhookTools(id, merged);
}
