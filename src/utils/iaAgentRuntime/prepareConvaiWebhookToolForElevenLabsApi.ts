/**
 * Prepara tool webhook ConvAI per API ElevenLabs: gateway Omnia + rewrite tunnel dev + validazione URL pubblico.
 */

import type { ConvaiAgentSyncParams } from '@domain/convai/convaiAgentSyncTypes';
import {
  isKbDeterministicDeployMode,
  normalizeAgentConvaiDeployMode,
} from '@domain/convai/agentConvaiDeployMode';
import {
  analyzeLocalhostEndpointReachability,
  rewriteCompilePayloadWithDevTunnel,
} from '@domain/devTunnel/devTunnelCompileBridge';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { deriveBackendToolDefinition } from '@domain/iaAgentTools/backendToolDerivation';
import { readBackendCallEndpoint } from '@domain/iaAgentTools/backendCallEndpoint';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, type Task } from '@types/taskTypes';
import { resolveTaskIaConfig } from './resolveTaskIaConfig';
import {
  buildConvaiWebhookToolFromBackendTask,
  type BuildConvaiWebhookFromBackendTaskResult,
} from './elevenLabsConvaiToolsPayload';
import { sanitizeConvaiWebhookToolForApi } from '@domain/openApi/sanitizeConvaiWebhookToolForApi';
import {
  buildOmniaDialogStepConvaiTool,
  OMNIA_DIALOG_STEP_TOOL_NAME,
} from './omniaDialogStepConvaiTool';

export type PrepareConvaiWebhookToolParams = {
  backendTask: Task;
  projectId: string;
  agentTaskId: string;
  /** Applica rewrite ngrok su URL gateway (default true). */
  useDevTunnel?: boolean;
};

export type PrepareConvaiWebhookToolResult =
  | { ok: true; tool: Record<string, unknown>; publicUrl: string }
  | { ok: false; error: string; missingPorts?: number[] };

export type ConvaiWebhookTunnelReadiness = {
  ready: boolean;
  errors: string[];
  /** URL effettivo inviato a ElevenLabs (dopo gateway + tunnel), per backend con POST webhook. */
  publicUrlsByBackendId: Record<string, string>;
};

export type ConvaiWebhookUrlPreviewRow = {
  backendTaskId: string;
  label: string;
  toolName: string;
  method: string;
  /** URL che verrebbe inviato a ElevenLabs (gateway Omnia + tunnel ngrok se attivo). */
  webhookUrl: string;
  reachable: boolean;
  reachabilityMessage?: string;
  buildError?: string;
};

function extractWebhookUrlFromTool(tool: Record<string, unknown>): string {
  const api = tool.api_schema;
  if (!api || typeof api !== 'object' || Array.isArray(api)) return '';
  const url = (api as Record<string, unknown>).url;
  return typeof url === 'string' ? url.trim() : '';
}

/** URL tool omnia_dialog_step dopo gateway Express + rewrite tunnel (sync kb_deterministic). */
function buildOmniaDialogStepToolPublicUrl(
  projectId: string,
  agentTaskId: string,
  useDevTunnel: boolean
): string {
  let tool = buildOmniaDialogStepConvaiTool({ projectId, agentTaskId });
  if (useDevTunnel) {
    tool = rewriteCompilePayloadWithDevTunnel(tool) as Record<string, unknown>;
  }
  tool = sanitizeConvaiWebhookToolForApi(tool);
  return extractWebhookUrlFromTool(tool);
}

function collectOmniaDialogStepTunnelReadiness(
  projectId: string,
  agentTaskId: string,
  useDevTunnel: boolean
): { error?: string; publicUrl?: string } {
  if (!projectId || !agentTaskId) {
    return {
      error:
        'omnia_dialog_step: projectId o agentTaskId mancante — impossibile pubblicare webhook dialogo KB.',
    };
  }
  const publicUrl = buildOmniaDialogStepToolPublicUrl(projectId, agentTaskId, useDevTunnel);
  if (!useDevTunnel) return { publicUrl };
  const reach = analyzeLocalhostEndpointReachability(publicUrl);
  if (reach.unreachable) {
    return {
      error: `omnia_dialog_step: ${reach.message ?? 'webhook non raggiungibile da cloud.'}`,
    };
  }
  return { publicUrl };
}

/** Backend Call referenziati come tool webhook per sync agente ConvAI. */
export function resolveConvaiSyncBackendTaskIds(
  params: Pick<ConvaiAgentSyncParams, 'agentTask' | 'manualCatalogBackendTaskIds'>
): string[] {
  const cfg = resolveTaskIaConfig(params.agentTask);
  const fromCfg = (cfg.convaiBackendToolTaskIds ?? [])
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const fromCatalog = params.manualCatalogBackendTaskIds ?? [];
  return mergeConvaiBackendToolIdLists(fromCfg, fromCatalog);
}

type BuiltConvaiWebhookToolPayload =
  | { ok: false; error: string }
  | { ok: true; tool: Record<string, unknown>; publicUrl: string; toolName: string; method: string };

/** Costruisce payload tool + URL dopo gateway e rewrite tunnel (senza validazione reachability). */
function buildConvaiWebhookToolPayloadForElevenLabs(
  params: PrepareConvaiWebhookToolParams
): BuiltConvaiWebhookToolPayload {
  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(params.agentTaskId ?? '').trim();
  if (!projectId) {
    return {
      ok: false,
      error:
        'ProjectId mancante — impossibile costruire URL gateway webhook. Riapri il progetto e riprova.',
    };
  }
  if (!agentTaskId) {
    return { ok: false, error: 'AgentTaskId mancante.' };
  }

  const built: BuildConvaiWebhookFromBackendTaskResult = buildConvaiWebhookToolFromBackendTask(
    params.backendTask,
    { convaiGateway: { projectId, agentTaskId } }
  );
  if (!built.ok) return built;

  const useDevTunnel = params.useDevTunnel !== false;
  const tool = sanitizeConvaiWebhookToolForApi(
    (useDevTunnel ? rewriteCompilePayloadWithDevTunnel(built.tool) : built.tool) as Record<
      string,
      unknown
    >
  );
  const publicUrl = extractWebhookUrlFromTool(tool);
  const dr = deriveBackendToolDefinition(params.backendTask);
  const toolName = dr.ok ? dr.tool.name : String(built.tool.name ?? '').trim() || 'webhook';
  const { method } = readBackendCallEndpoint(params.backendTask);

  return { ok: true, tool, publicUrl, toolName, method };
}

/** URL gateway per test designer (tunnel ngrok se attivo). */
export function resolveConvaiWebhookGatewayTestUrl(
  params: PrepareConvaiWebhookToolParams
): { ok: true; publicUrl: string } | { ok: false; error: string } {
  const built = buildConvaiWebhookToolPayloadForElevenLabs(params);
  if (!built.ok) return built;
  return { ok: true, publicUrl: built.publicUrl };
}

/**
 * Costruisce tool webhook con URL gateway Omnia, applica tunnel ngrok e verifica raggiungibilità da cloud.
 */
export function prepareConvaiWebhookToolForElevenLabsApi(
  params: PrepareConvaiWebhookToolParams
): PrepareConvaiWebhookToolResult {
  const built = buildConvaiWebhookToolPayloadForElevenLabs(params);
  if (!built.ok) return built;

  if (params.useDevTunnel === false) {
    return { ok: true, tool: built.tool, publicUrl: built.publicUrl };
  }

  const reach = analyzeLocalhostEndpointReachability(built.publicUrl);
  if (reach.unreachable) {
    return {
      ok: false,
      error:
        reach.message ??
        'Webhook non raggiungibile: avvia il tunnel dev (Impostazioni → Tunnel dev / ngrok) prima del sync.',
      missingPorts: reach.missingPorts,
    };
  }

  return { ok: true, tool: built.tool, publicUrl: built.publicUrl };
}

/**
 * Anteprima URL webhook ElevenLabs per ogni backend catalogo (solo UI — non va nel prompt markdown).
 */
export function buildConvaiWebhookUrlPreviewRows(
  params: Pick<ConvaiAgentSyncParams, 'agentTask' | 'projectId' | 'manualCatalogBackendTaskIds'> & {
    catalogLabelsByBackendId?: Readonly<Record<string, string>>;
  },
  getTask: (id: string) => Task | null | undefined = taskRepository.getTask.bind(taskRepository)
): ConvaiWebhookUrlPreviewRow[] {
  const backendIds = resolveConvaiSyncBackendTaskIds(params);
  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(params.agentTask.id ?? '').trim();
  const labels = params.catalogLabelsByBackendId ?? {};

  const rows: ConvaiWebhookUrlPreviewRow[] = [];

  for (const bid of backendIds) {
    const bt = getTask(bid);
    const label =
      labels[bid]?.trim() ||
      String(bt?.label ?? '').trim() ||
      bid;
    if (!bt || bt.type !== TaskType.BackendCall) {
      rows.push({
        backendTaskId: bid,
        label,
        toolName: '—',
        method: '—',
        webhookUrl: '',
        reachable: false,
        buildError: `Backend «${bid}» non trovato o non è un Backend Call.`,
      });
      continue;
    }

    const built = buildConvaiWebhookToolPayloadForElevenLabs({
      backendTask: bt,
      projectId,
      agentTaskId,
    });
    if (!built.ok) {
      rows.push({
        backendTaskId: bid,
        label,
        toolName: '—',
        method: readBackendCallEndpoint(bt).method,
        webhookUrl: '',
        reachable: false,
        buildError: built.error,
      });
      continue;
    }

    const reach = analyzeLocalhostEndpointReachability(built.publicUrl);
    rows.push({
      backendTaskId: bid,
      label,
      toolName: built.toolName,
      method: built.method,
      webhookUrl: built.publicUrl,
      reachable: !reach.unreachable,
      reachabilityMessage: reach.message,
    });
  }

  return rows;
}

/** Anteprima readiness tunnel per tutti i webhook del sync (UI + validate pre-sync). */
export function collectConvaiWebhookTunnelReadinessForSync(
  params: Pick<
    ConvaiAgentSyncParams,
    'agentTask' | 'projectId' | 'manualCatalogBackendTaskIds' | 'useDevTunnelForWebhook'
  >,
  getTask: (id: string) => Task | null | undefined = taskRepository.getTask.bind(taskRepository)
): ConvaiWebhookTunnelReadiness {
  const backendIds = resolveConvaiSyncBackendTaskIds(params);
  const useDevTunnel = params.useDevTunnelForWebhook !== false;
  const kbDeterministic = isKbDeterministicDeployMode(
    normalizeAgentConvaiDeployMode(params.agentTask.agentConvaiDeployMode)
  );

  if (backendIds.length === 0 && !kbDeterministic) {
    return { ready: true, errors: [], publicUrlsByBackendId: {} };
  }

  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(params.agentTask.id ?? '').trim();
  const errors: string[] = [];
  const publicUrlsByBackendId: Record<string, string> = {};

  if (!projectId) {
    return {
      ready: false,
      errors: [
        'ProjectId mancante: impossibile pubblicare webhook con gateway Omnia. Riapri il progetto e riprova.',
      ],
      publicUrlsByBackendId,
    };
  }

  for (const bid of backendIds) {
    const bt = getTask(bid);
    if (!bt || bt.type !== TaskType.BackendCall) {
      errors.push(`Backend «${bid}» non trovato o non è un Backend Call.`);
      continue;
    }
    const prepared = prepareConvaiWebhookToolForElevenLabsApi({
      backendTask: bt,
      projectId,
      agentTaskId,
      useDevTunnel,
    });
    if (!prepared.ok) {
      errors.push(`${String(bt.label ?? bid).trim() || bid}: ${prepared.error}`);
      continue;
    }
    publicUrlsByBackendId[bid] = prepared.publicUrl;
  }

  if (kbDeterministic) {
    const dialog = collectOmniaDialogStepTunnelReadiness(projectId, agentTaskId, useDevTunnel);
    if (dialog.error) errors.push(dialog.error);
    else if (dialog.publicUrl) {
      publicUrlsByBackendId[OMNIA_DIALOG_STEP_TOOL_NAME] = dialog.publicUrl;
    }
  }

  if (!useDevTunnel) {
    return { ready: errors.length === 0, errors, publicUrlsByBackendId };
  }

  return { ready: errors.length === 0, errors, publicUrlsByBackendId };
}
